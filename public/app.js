(function () {
  const inviteCodeInput = document.getElementById("inviteCode");
  const otpInput = document.getElementById("otp");
  const androidBtn = document.getElementById("androidBtn");
  const iosBtn = document.getElementById("iosBtn");
  const statusEl = document.getElementById("status");

  const params = new URLSearchParams(window.location.search);
  const inviteCode = (params.get("invite_code") || "").trim();
  const apiBase = (window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBase) || "";

  inviteCodeInput.value = inviteCode;

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function setLoading(isLoading) {
    androidBtn.disabled = isLoading;
    iosBtn.disabled = isLoading;
  }

  async function downloadRelease(platform) {
    if (!inviteCode) {
      setStatus("Invite code is missing in the link.", true);
      return;
    }
    const otp = otpInput.value.trim();
    if (!otp) {
      setStatus("Please enter OTP.", true);
      return;
    }
    if (!apiBase) {
      setStatus("API base URL is not configured.", true);
      return;
    }

    setLoading(true);
    setStatus("Validating invite and preparing download...");

    try {
      const endpoint =
        platform === "android" ? "/v1/releases/android/latest" : "/v1/releases/ios/latest";
      const url =
        `${apiBase}${endpoint}?invite_code=${encodeURIComponent(inviteCode)}` +
        `&otp=${encodeURIComponent(otp)}`;

      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        let detail = "Download failed.";
        try {
          const body = await response.json();
          detail = body.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      let filename = platform === "android" ? "latest.apk" : "latest.ipa";
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const parts = contentDisposition.split("filename=");
        filename = parts[1].replace(/"/g, "").trim() || filename;
      }

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      setStatus("Download started. This invite code is now marked as used.");
    } catch (error) {
      setStatus(error.message || "Download failed.", true);
    } finally {
      setLoading(false);
    }
  }

  androidBtn.addEventListener("click", function () {
    downloadRelease("android");
  });

  iosBtn.addEventListener("click", function () {
    downloadRelease("ios");
  });
})();
