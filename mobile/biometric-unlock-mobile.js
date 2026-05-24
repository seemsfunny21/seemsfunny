/* ============================================================================
   🔐 PEGASUS MOBILE BIOMETRIC UNLOCK (v1.3)
   Protocol: WebAuthn / Platform Authenticator bridge for existing PIN vault
   Status: SEPARATE MODULE | NO FINGERPRINT DATA STORED | APPROVED-DEVICE GATE
   Fix v1.3: HTTPS-only dormant mode, no app errors on non-secure origins
   ============================================================================ */

(function() {
    "use strict";

    const MODULE_VERSION = "1.3.243";
    const STORAGE = {
        enabled: "pegasus_biometric_unlock_enabled_v1",
        credentialId: "pegasus_biometric_credential_id_v1",
        userId: "pegasus_biometric_user_id_v1",
        createdAt: "pegasus_biometric_created_at_v1",
        dismissedPrompt: "pegasus_biometric_prompt_dismissed_v1",
        promptShownAt: "pegasus_biometric_prompt_last_shown_v1"
    };

    const GREEN = "#00ff41";
    const ERROR = "#ff4444";
    const MUTED = "#777";

    let observer = null;
    let pulseTimer = null;
    let cloudHooksInstalled = false;
    let promptScheduled = false;
    let renderScheduled = false;
    let rendering = false;

    function scheduleRender(delay = 120) {
        if (renderScheduled || rendering) return;
        renderScheduled = true;
        setTimeout(() => {
            renderScheduled = false;
            renderAllBiometricButtons();
        }, delay);
    }

    function log(...args) {
        console.log("🔐 PEGASUS BIOMETRIC:", ...args);
    }

    function warn(...args) {
        console.warn("🔐 PEGASUS BIOMETRIC:", ...args);
    }

    function isSecureEnough() {
        return !!(
            window.isSecureContext &&
            navigator.credentials &&
            window.PublicKeyCredential &&
            window.crypto &&
            crypto.getRandomValues
        );
    }

    function isMobileRuntime() {
        return !!(window.PEGASUS_IS_MOBILE || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""));
    }

    function randomBytes(length = 32) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    }

    function toBase64Url(buffer) {
        const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer);
        let binary = "";
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function fromBase64Url(value) {
        const clean = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
        const padded = clean + "=".repeat((4 - clean.length % 4) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    function hasCredential() {
        return localStorage.getItem(STORAGE.enabled) === "1" && !!localStorage.getItem(STORAGE.credentialId);
    }

    function cloud() {
        return window.PegasusCloud || null;
    }

    function canRestorePegasusVault() {
        try { return !!cloud()?.canRestoreApprovedDevice?.(); } catch (_) { return false; }
    }

    function isVaultUnlocked() {
        try { return !!cloud()?.isUnlocked; } catch (_) { return false; }
    }

    function setMainError(message, color = ERROR) {
        const errorDiv = document.getElementById("pinError");
        if (errorDiv) {
            errorDiv.textContent = message || "";
            errorDiv.style.color = color;
        }
    }

    function setSocialError(message, color = ERROR) {
        const err = document.querySelector("#socialLockScreen #pinError") || document.getElementById("pinError");
        if (err) {
            err.textContent = message || "";
            err.style.display = message ? "block" : "none";
            err.style.color = color;
        }
    }

    function clearDismissedPrompt() {
        localStorage.removeItem(STORAGE.dismissedPrompt);
    }

    async function platformAvailable() {
        if (!isSecureEnough()) return false;
        try {
            if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
                return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            }
        } catch (_) {}
        return true;
    }

    async function createCredential() {
        if (!isSecureEnough()) throw new Error("UNSUPPORTED_BROWSER");
        const available = await platformAvailable();
        if (!available) throw new Error("NO_PLATFORM_AUTHENTICATOR");

        const userId = randomBytes(32);
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: randomBytes(32),
                rp: { name: "Pegasus OS" },
                user: {
                    id: userId,
                    name: "pegasus-mobile-device",
                    displayName: "Pegasus Mobile Device"
                },
                pubKeyCredParams: [
                    { type: "public-key", alg: -7 },
                    { type: "public-key", alg: -257 }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    residentKey: "preferred",
                    userVerification: "required"
                },
                timeout: 60000,
                attestation: "none"
            }
        });

        if (!credential?.rawId) throw new Error("NO_CREDENTIAL");

        localStorage.setItem(STORAGE.enabled, "1");
        localStorage.setItem(STORAGE.credentialId, toBase64Url(credential.rawId));
        localStorage.setItem(STORAGE.userId, toBase64Url(userId));
        localStorage.setItem(STORAGE.createdAt, String(Date.now()));
        clearDismissedPrompt();
        log("enabled", MODULE_VERSION);
        return true;
    }

    async function verifyCredential() {
        if (!isSecureEnough()) throw new Error("UNSUPPORTED_BROWSER");
        const credentialId = localStorage.getItem(STORAGE.credentialId);
        if (!credentialId) throw new Error("NOT_ENROLLED");

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: randomBytes(32),
                allowCredentials: [{
                    type: "public-key",
                    id: fromBase64Url(credentialId),
                    transports: ["internal"]
                }],
                userVerification: "required",
                timeout: 60000
            }
        });

        if (!assertion?.rawId) throw new Error("AUTH_FAILED");
        return true;
    }

    function humanError(e) {
        const msg = String(e?.name || e?.message || e || "");
        if (/NotAllowed|Abort/i.test(msg)) return "Ακυρώθηκε το δαχτυλικό";
        if (/Security|UNSUPPORTED/i.test(msg)) return "Το δαχτυλικό δουλεύει μόνο από HTTPS ή localhost";
        if (/NO_PLATFORM/i.test(msg)) return "Δεν βρέθηκε δαχτυλικό / κλείδωμα οθόνης";
        if (/NOT_ENROLLED/i.test(msg)) return "Πρώτα κάνε ενεργοποίηση δαχτυλικού";
        if (/NO_APPROVED_DEVICE_MATERIAL/i.test(msg)) return "Γράψε μία φορά PIN + master key σε αυτή τη συσκευή";
        return "Δεν έγινε βιομετρικό ξεκλείδωμα · βάλε PIN";
    }

    async function finalizeVaultUnlock(source) {
        if (window.PegasusMobileVault?.finishUnlock) {
            await window.PegasusMobileVault.finishUnlock(source || "biometric");
            return;
        }

        const modal = document.getElementById("pinModal");
        if (modal) modal.style.display = "none";
        try { window.refreshAllUI?.(); } catch (_) {}
    }

    async function biometricUnlockMain() {
        const button = document.getElementById("pegasusBiometricUnlockBtn") || document.getElementById("pegasusBiometricSettingsUnlockBtn");
        try {
            if (button) button.disabled = true;
            setMainError("Αναμονή για δαχτυλικό...", GREEN);

            await verifyCredential();

            if (!canRestorePegasusVault()) {
                throw new Error("NO_APPROVED_DEVICE_MATERIAL");
            }

            setMainError("Βιομετρικό OK · άνοιγμα vault...", GREEN);
            const success = await cloud().tryApprovedDeviceUnlock();

            if (!success) throw new Error("RESTORE_FAILED");

            await finalizeVaultUnlock("biometric");
            setTimeout(() => setMainError(""), 250);
            renderAllBiometricButtons();
        } catch (e) {
            warn("main unlock failed", e);
            setMainError(humanError(e));
            alert(humanError(e));
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function enableBiometricFromPrompt() {
        const button = document.getElementById("pegasusBiometricEnableBtn") ||
            document.getElementById("pegasusBiometricPromptEnable") ||
            document.getElementById("pegasusBiometricSettingsEnableBtn");
        try {
            if (button) button.disabled = true;

            if (!isSecureEnough()) {
                alert("❌ Το δαχτυλικό θέλει HTTPS/Chrome και κλείδωμα οθόνης στο κινητό.");
                return false;
            }

            if (!isVaultUnlocked() || !canRestorePegasusVault()) {
                alert("Πρώτα κάνε μία φορά απασφάλιση με PIN + master key σε αυτή τη συσκευή. Μετά ξαναπάτα ενεργοποίηση δαχτυλικού.");
                return false;
            }

            await createCredential();
            renderAllBiometricButtons();
            hideEnrollmentPrompt();
            alert("✅ Ενεργοποιήθηκε. Από την επόμενη φορά που θα ζητήσει PIN, θα μπορείς να πατάς δαχτυλικό.");
            return true;
        } catch (e) {
            warn("enable failed", e);
            alert("❌ Δεν ενεργοποιήθηκε το δαχτυλικό. Έλεγξε ότι το κινητό έχει δαχτυλικό/κλείδωμα οθόνης και ότι ανοίγεις το Pegasus από HTTPS/Chrome.\n\n" + humanError(e));
            return false;
        } finally {
            if (button) button.disabled = false;
        }
    }

    function buildButton(id, label, onclickName, primary = true) {
        const btn = document.createElement("button");
        btn.id = id;
        btn.type = "button";
        btn.className = primary ? "primary-btn" : "secondary-btn";
        btn.textContent = label;
        btn.style.marginTop = "12px";
        btn.style.padding = "15px";
        btn.style.fontSize = "12px";
        btn.style.borderRadius = "14px";
        btn.style.letterSpacing = "1px";
        btn.style.border = `1px solid ${primary ? GREEN : "#333"}`;
        btn.style.color = primary ? "#000" : GREEN;
        btn.style.background = primary ? GREEN : "transparent";
        btn.style.width = "100%";
        btn.onclick = () => window.PegasusBiometricUnlock?.[onclickName]?.();
        return btn;
    }

    function renderMainButton() {
        const modal = document.getElementById("pinModal");
        if (!modal || !isSecureEnough()) return;
        const panel = modal.querySelector("div");
        if (!panel) return;

        const unlockBtn = document.getElementById("pegasusBiometricUnlockBtn");
        const enableBtn = document.getElementById("pegasusBiometricEnableBtn");
        const hasBio = hasCredential();
        const canRestore = canRestorePegasusVault();

        if (hasBio) {
            enableBtn?.remove();
            if (!unlockBtn) {
                const offlineButton = Array.from(panel.querySelectorAll("button")).find(btn => /Offline|ΛΕΙΤΟΥΡΓΙΑ/i.test(btn.textContent || ""));
                const btn = buildButton("pegasusBiometricUnlockBtn", "🔐 Ξεκλείδωμα με δαχτυλικό", "unlockMain", true);
                panel.insertBefore(btn, offlineButton || null);
            }
            return;
        }

        unlockBtn?.remove();

        // If the device is already approved/unlocked, allow enrollment from the modal too.
        if (canRestore && isVaultUnlocked()) {
            if (!enableBtn) {
                const offlineButton = Array.from(panel.querySelectorAll("button")).find(btn => /Offline|ΛΕΙΤΟΥΡΓΙΑ/i.test(btn.textContent || ""));
                const btn = buildButton("pegasusBiometricEnableBtn", "➕ Ενεργοποίηση δαχτυλικού", "enable", false);
                panel.insertBefore(btn, offlineButton || null);
            }
            return;
        }

        enableBtn?.remove();
    }

    async function biometricUnlockSocial() {
        try {
            setSocialError("Αναμονή για δαχτυλικό...", GREEN);
            await verifyCredential();

            const savedPin = localStorage.getItem("pegasus_master_pin");
            const input = document.getElementById("socialPinInput");
            if (!savedPin || !input || !window.PegasusSocial?.verifyPin) {
                throw new Error("SOCIAL_PIN_NOT_READY");
            }

            input.value = savedPin;
            window.PegasusSocial.verifyPin();
            input.value = "";
            setSocialError("");
        } catch (e) {
            warn("social unlock failed", e);
            setSocialError(humanError(e));
        }
    }

    function renderSocialButton() {
        const screen = document.getElementById("socialLockScreen");
        if (!screen || !isSecureEnough() || !hasCredential()) return;
        if (document.getElementById("pegasusBiometricSocialBtn")) return;

        const unlockButton = Array.from(screen.querySelectorAll("button")).find(btn => /Ξεκλείδωμα/i.test(btn.textContent || ""));
        const btn = buildButton("pegasusBiometricSocialBtn", "🔐 Δαχτυλικό", "unlockSocial", true);
        btn.style.width = "150px";
        btn.style.marginTop = "10px";

        if (unlockButton?.parentNode) {
            unlockButton.parentNode.insertBefore(btn, unlockButton.nextSibling);
        } else {
            screen.appendChild(btn);
        }
    }

    function renderSettingsCard() {
        const panel = document.getElementById("settings_panel");
        if (!panel) return;

        let card = document.getElementById("pegasusBiometricSettingsCard");
        if (!card) {
            card = document.createElement("div");
            card.id = "pegasusBiometricSettingsCard";
            card.className = "mini-card";
            card.style.marginTop = "22px";
            card.style.padding = "20px";
            card.style.borderColor = GREEN;
            card.style.background = "rgba(0,255,65,0.04)";

            const firstTitle = Array.from(panel.querySelectorAll(".section-title")).find(x => /ΔΙΑΧΕΙΡΙΣΗ/i.test(x.textContent || ""));
            if (firstTitle) {
                panel.insertBefore(card, firstTitle);
            } else {
                panel.appendChild(card);
            }
        }

        const supported = isSecureEnough();
        const enrolled = hasCredential();
        const unlocked = isVaultUnlocked();
        const restorable = canRestorePegasusVault();

        let status = "";
        if (!supported) status = "Μη διαθέσιμο εδώ: χρειάζεται HTTPS/Chrome και κλείδωμα οθόνης.";
        else if (enrolled) status = "Ενεργό σε αυτή τη συσκευή.";
        else if (unlocked && restorable) status = "Έτοιμο για ενεργοποίηση σε αυτή τη συσκευή.";
        else status = "Πρώτα κάνε PIN + master key μία φορά στο κινητό.";

        const actionHtml = enrolled
            ? `<button id="pegasusBiometricSettingsUnlockBtn" class="primary-btn" style="width:100%; margin-top:12px; padding:14px; font-size:11px;">🔐 Δοκιμή δαχτυλικού</button>
               <button id="pegasusBiometricSettingsResetBtn" class="secondary-btn" style="width:100%; margin-top:10px; padding:12px; font-size:10px; color:#777; border-color:#333;">Απενεργοποίηση σε αυτή τη συσκευή</button>`
            : `<button id="pegasusBiometricSettingsEnableBtn" class="primary-btn" style="width:100%; margin-top:12px; padding:14px; font-size:11px;" ${(!supported || !unlocked || !restorable) ? "disabled" : ""}>➕ Ενεργοποίηση δαχτυλικού</button>`;

        const signature = JSON.stringify({ supported, enrolled, unlocked, restorable, status });
        if (card.dataset.biometricSignature === signature) return;
        card.dataset.biometricSignature = signature;

        card.innerHTML = `
            <span class="mini-label" style="display:block; margin-bottom:10px;">🔐 Βιομετρικό ξεκλείδωμα</span>
            <div style="font-size:11px; line-height:1.45; color:${enrolled ? GREEN : MUTED}; font-weight:800; text-transform:none; letter-spacing:.5px;">${status}</div>
            ${actionHtml}
        `;

        document.getElementById("pegasusBiometricSettingsEnableBtn")?.addEventListener("click", enableBiometricFromPrompt);
        document.getElementById("pegasusBiometricSettingsUnlockBtn")?.addEventListener("click", async () => {
            try {
                await verifyCredential();
                alert("✅ Το δαχτυλικό δουλεύει για το Pegasus.");
            } catch (e) {
                alert("❌ Δοκιμή απέτυχε. " + humanError(e));
            }
        });
        document.getElementById("pegasusBiometricSettingsResetBtn")?.addEventListener("click", () => {
            if (!confirm("Απενεργοποίηση δαχτυλικού μόνο για αυτή τη συσκευή;")) return;
            reset();
            renderAllBiometricButtons();
        });
    }

    function renderAllBiometricButtons() {
        if (rendering) return;
        rendering = true;
        try {
            renderMainButton();
            renderSocialButton();
            renderSettingsCard();
        } catch (e) {
            warn("render failed", e);
        } finally {
            rendering = false;
        }
    }

    function hideEnrollmentPrompt() {
        document.getElementById("pegasusBiometricEnrollPrompt")?.remove();
    }

    function showEnrollmentPrompt(force = false) {
        if (!isMobileRuntime() || !isSecureEnough() || hasCredential()) return;
        if (!isVaultUnlocked() || !canRestorePegasusVault()) return;
        if (!force && localStorage.getItem(STORAGE.dismissedPrompt) === "1") return;
        if (document.getElementById("pegasusBiometricEnrollPrompt")) return;

        localStorage.setItem(STORAGE.promptShownAt, String(Date.now()));

        const box = document.createElement("div");
        box.id = "pegasusBiometricEnrollPrompt";
        box.style.position = "fixed";
        box.style.left = "14px";
        box.style.right = "14px";
        box.style.bottom = "18px";
        box.style.zIndex = "9998";
        box.style.background = "rgba(0,0,0,0.96)";
        box.style.border = `1px solid ${GREEN}`;
        box.style.borderRadius = "18px";
        box.style.padding = "14px";
        box.style.boxShadow = "0 0 30px rgba(0,255,65,0.20)";
        box.style.color = "#ddd";
        box.style.textAlign = "center";
        box.innerHTML = `
            <div style="font-size:12px; font-weight:900; color:${GREEN}; letter-spacing:1px; margin-bottom:6px;">🔐 PEGASUS δαχτυλικό</div>
            <div style="font-size:11px; line-height:1.45; color:#aaa; margin-bottom:10px;">Ενεργοποίησέ το για να ξεκλειδώνει το mobile χωρίς να γράφεις PIN + master key κάθε φορά.</div>
            <div style="display:flex; gap:8px;">
                <button id="pegasusBiometricPromptEnable" class="primary-btn" style="flex:1; margin:0; padding:12px; font-size:11px;">Ενεργοποίηση</button>
                <button id="pegasusBiometricPromptLater" class="secondary-btn" style="flex:1; margin:0; padding:12px; font-size:11px; color:#777; border-color:#333;">Αργότερα</button>
            </div>
        `;
        document.body.appendChild(box);
        document.getElementById("pegasusBiometricPromptEnable")?.addEventListener("click", enableBiometricFromPrompt);
        document.getElementById("pegasusBiometricPromptLater")?.addEventListener("click", () => {
            localStorage.setItem(STORAGE.dismissedPrompt, "1");
            hideEnrollmentPrompt();
        });
    }

    function scheduleEnrollmentPrompt(force = false) {
        if (promptScheduled) return;
        promptScheduled = true;
        setTimeout(() => {
            promptScheduled = false;
            showEnrollmentPrompt(force);
        }, 700);
    }

    function afterSuccessfulUnlock(source = "manual") {
        renderAllBiometricButtons();
        if (source !== "biometric") {
            scheduleEnrollmentPrompt(false);
        }
    }

    function reset() {
        localStorage.removeItem(STORAGE.enabled);
        localStorage.removeItem(STORAGE.credentialId);
        localStorage.removeItem(STORAGE.userId);
        localStorage.removeItem(STORAGE.createdAt);
        clearDismissedPrompt();
        renderAllBiometricButtons();
        log("disabled locally");
    }

    function status() {
        const data = {
            version: MODULE_VERSION,
            mobile: isMobileRuntime(),
            secureContext: !!window.isSecureContext,
            supported: isSecureEnough(),
            enrolled: hasCredential(),
            cloudUnlocked: isVaultUnlocked(),
            canRestoreApprovedDevice: canRestorePegasusVault(),
            hasWrappedMaster: !!localStorage.getItem(cloud()?.storage?.wrappedMaster || ""),
            hasDeviceSecret: !!localStorage.getItem(cloud()?.storage?.deviceSecret || ""),
            approvedDevice: localStorage.getItem(cloud()?.storage?.approvedDevice || "") || localStorage.getItem(cloud()?.storage?.desktopApproved || "") || "0",
            dismissedPrompt: localStorage.getItem(STORAGE.dismissedPrompt) || "0"
        };
        console.table(data);
        return data;
    }

    function installCloudHooks() {
        const pc = cloud();
        if (!pc || cloudHooksInstalled) return;
        cloudHooksInstalled = true;

        const originalUnlock = typeof pc.unlock === "function" ? pc.unlock.bind(pc) : null;
        if (originalUnlock) {
            pc.unlock = async function biometricPatchedUnlock(...args) {
                const result = await originalUnlock(...args);
                if (result) setTimeout(() => afterSuccessfulUnlock("manual"), 0);
                return result;
            };
        }

        const originalRestore = typeof pc.restoreApprovedDevice === "function" ? pc.restoreApprovedDevice.bind(pc) : null;
        if (originalRestore) {
            pc.restoreApprovedDevice = async function biometricPatchedRestore(...args) {
                const result = await originalRestore(...args);
                if (result) setTimeout(() => afterSuccessfulUnlock("auto"), 0);
                return result;
            };
        }
    }

    function pulse() {
        installCloudHooks();
        renderAllBiometricButtons();
        if (isVaultUnlocked() && canRestorePegasusVault() && !hasCredential()) {
            scheduleEnrollmentPrompt(false);
        }
    }

    function init() {
        // WebAuthn / fingerprint is allowed by the browser only on HTTPS or localhost.
        // On plain HTTP/file/IP origins we keep Pegasus fully usable and simply leave
        // the biometric module dormant. This prevents mobile load errors and SW/HTTPS confusion.
        if (!isSecureEnough()) {
            log(`dormant v${MODULE_VERSION}: needs HTTPS/localhost secure context`);
            return;
        }

        installCloudHooks();
        renderAllBiometricButtons();

        try {
            if (observer) observer.disconnect();
            observer = new MutationObserver(() => scheduleRender(160));
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) {
            warn("observer failed", e);
        }

        window.addEventListener("pegasus_sync_complete", () => {
            scheduleRender(80);
            if (isVaultUnlocked() && canRestorePegasusVault() && !hasCredential()) scheduleEnrollmentPrompt(false);
        });
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) pulse();
        });
        window.addEventListener("focus", pulse);

        if (pulseTimer) clearInterval(pulseTimer);
        pulseTimer = setInterval(pulse, 1500);

        log(`ready v${MODULE_VERSION}`);
    }

    window.PegasusBiometricUnlock = {
        enable: enableBiometricFromPrompt,
        unlockMain: biometricUnlockMain,
        unlockSocial: biometricUnlockSocial,
        afterSuccessfulUnlock,
        showPrompt: () => showEnrollmentPrompt(true),
        render: renderAllBiometricButtons,
        reset,
        status,
        isEnabled: hasCredential,
        isSupported: isSecureEnough,
        version: MODULE_VERSION
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
