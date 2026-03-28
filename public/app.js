(function () {
  const inviteCodeInput = document.getElementById("inviteCode");
  const otpInput = document.getElementById("otp");
  const androidBtn = document.getElementById("androidBtn");
  const iosBtn = document.getElementById("iosBtn");
  const statusEl = document.getElementById("status");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressPercent = document.getElementById("progressPercent");
  const progressMeta = document.getElementById("progressMeta");
  const progressTrack =
    progressWrap && progressWrap.querySelector(".progress-track");
  const postDownload = document.getElementById("postDownload");
  const installBtn = document.getElementById("installBtn");
  const locateBtn = document.getElementById("locateBtn");
  const installHint = document.getElementById("installHint");

  const params = new URLSearchParams(window.location.search);
  const inviteCode = (params.get("invite_code") || "").trim();
  const apiBase = (window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBase) || "";

  inviteCodeInput.value = inviteCode;

  let lastDownload = {
    platform: "",
    filename: "",
    blob: null,
    blobUrl: "",
  };

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function setHint(message) {
    if (!installHint) {
      return;
    }
    installHint.textContent = message || "";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 MB";
    }
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(unitIndex >= 2 ? 2 : 0)} ${units[unitIndex]}`;
  }

  function clearDownloadState() {
    if (lastDownload.blobUrl) {
      window.URL.revokeObjectURL(lastDownload.blobUrl);
    }
    lastDownload = {
      platform: "",
      filename: "",
      blob: null,
      blobUrl: "",
    };
  }

  function hidePostDownloadActions() {
    if (!postDownload) {
      return;
    }
    postDownload.classList.remove("active");
    setHint("");
  }

  function showPostDownloadActions(platform, filename, blob) {
    if (!postDownload) {
      return;
    }

    clearDownloadState();
    const blobUrl = window.URL.createObjectURL(blob);
    lastDownload = {
      platform,
      filename,
      blob,
      blobUrl,
    };

    postDownload.classList.add("active");
    if (platform === "android") {
      setHint(
        `Downloaded as ${filename}. If install does not open, tap "Find Downloaded File" for exact steps.`,
      );
    } else {
      setHint(`Downloaded as ${filename}.`);
    }
  }

  function resetProgress() {
    if (!progressWrap) {
      return;
    }
    progressWrap.classList.remove("active", "indeterminate");
    progressFill.style.width = "0%";
    progressPercent.textContent = "0%";
    progressMeta.textContent = "0 MB / 0 MB";
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", "0");
    }
  }

  function showProgress() {
    if (!progressWrap) {
      return;
    }
    progressWrap.classList.add("active");
  }

  function setProgress(loadedBytes, totalBytes) {
    if (!progressWrap) {
      return;
    }
    showProgress();

    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      const percent = Math.max(
        0,
        Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
      );
      progressWrap.classList.remove("indeterminate");
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressMeta.textContent = `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`;
      if (progressTrack) {
        progressTrack.setAttribute("aria-valuenow", String(percent));
      }
      return;
    }

    progressWrap.classList.add("indeterminate");
    progressPercent.textContent = "Working...";
    progressMeta.textContent = `${formatBytes(loadedBytes)} downloaded`;
    if (progressTrack) {
      progressTrack.removeAttribute("aria-valuenow");
    }
  }

  function setLoading(isLoading) {
    androidBtn.disabled = isLoading;
    iosBtn.disabled = isLoading;
    otpInput.disabled = isLoading;
    if (installBtn) {
      installBtn.disabled = isLoading;
    }
    if (locateBtn) {
      locateBtn.disabled = isLoading;
    }
  }

  function parseFilename(contentDisposition, fallback) {
    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      return decodeURIComponent(utf8Match[1].trim());
    }

    const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (plainMatch && plainMatch[1]) {
      return plainMatch[1].trim();
    }

    return fallback;
  }

  async function downloadWithProgress(response, onProgress) {
    const totalHeader = response.headers.get("content-length");
    const totalBytes = Number.parseInt(totalHeader || "", 10);
    const normalizedTotal = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : 0;

    if (!response.body || !response.body.getReader) {
      const fallbackBlob = await response.blob();
      onProgress(fallbackBlob.size, fallbackBlob.size || normalizedTotal);
      return fallbackBlob;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        loadedBytes += value.byteLength;
        onProgress(loadedBytes, normalizedTotal);
      }
    }

    const finalTotal = normalizedTotal > 0 ? normalizedTotal : loadedBytes;
    onProgress(loadedBytes, finalTotal);

    return new Blob(chunks, {
      type: response.headers.get("content-type") || "application/octet-stream",
    });
  }

  async function openInstallForLastDownload() {
    if (!lastDownload.blob || !lastDownload.blobUrl) {
      setHint("Download APK first, then use Install APK.");
      return;
    }

    if (lastDownload.platform !== "android") {
      const link = document.createElement("a");
      link.href = lastDownload.blobUrl;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setHint("Opened downloaded file.");
      return;
    }

    const fileForShare = new File([lastDownload.blob], lastDownload.filename, {
      type: "application/vnd.android.package-archive",
    });

    try {
      if (
        navigator.canShare &&
        navigator.share &&
        navigator.canShare({ files: [fileForShare] })
      ) {
        await navigator.share({
          title: "Install Campaign Manager",
          text: "Open this APK with Package Installer",
          files: [fileForShare],
        });
        setHint(
          "Share sheet opened. Choose Package Installer / Files to continue install.",
        );
        return;
      }
    } catch (_) {
      // Fallback below.
    }

    const link = document.createElement("a");
    link.href = lastDownload.blobUrl;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setHint(
      "Install did not auto-open on this browser. Use 'Find Downloaded File' and open latest.apk from Downloads.",
    );
  }

  async function showLocateSteps() {
    const filename = lastDownload.filename || "latest.apk";
    const steps = [
      "1. Swipe down notification panel and tap the completed download.",
      "2. If not visible, open Files/File Manager app.",
      "3. Go to Downloads folder.",
      `4. Tap ${filename} to install.`,
    ].join(" ");

    setHint(steps);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(filename);
        setStatus(`Filename copied: ${filename}`, false);
      } catch (_) {
        // Ignore clipboard failures.
      }
    }
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
    hidePostDownloadActions();
    resetProgress();
    showProgress();
    setProgress(0, 0);
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

      setStatus("Download in progress...");
      const blob = await downloadWithProgress(response, setProgress);

      const fallbackName = platform === "android" ? "latest.apk" : "latest.ipa";
      const filename = parseFilename(
        response.headers.get("content-disposition"),
        fallbackName,
      );

      const tempUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = tempUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(tempUrl), 5000);

      showPostDownloadActions(platform, filename, blob);
      setStatus(
        `Download completed (${formatBytes(blob.size)}). You can now tap Install APK.`,
      );
    } catch (error) {
      setStatus(error.message || "Download failed.", true);
      hidePostDownloadActions();
      resetProgress();
    } finally {
      setLoading(false);
    }
  }

  resetProgress();
  hidePostDownloadActions();

  androidBtn.addEventListener("click", function () {
    downloadRelease("android");
  });

  iosBtn.addEventListener("click", function () {
    downloadRelease("ios");
  });

  if (installBtn) {
    installBtn.addEventListener("click", function () {
      openInstallForLastDownload();
    });
  }

  if (locateBtn) {
    locateBtn.addEventListener("click", function () {
      showLocateSteps();
    });
  }

  window.addEventListener("beforeunload", function () {
    clearDownloadState();
  });
})();
