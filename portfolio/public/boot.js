// If the app bundle has not replaced the boot placeholder after 20 s, say so
// instead of implying indefinite progress. A file (not an inline script) so the
// Content-Security-Policy can forbid inline scripts.
setTimeout(function () {
  var message = document.getElementById("boot-message");
  if (message && document.querySelector("[data-boot]")) {
    message.textContent = "This is taking longer than expected. Check your connection and reload the page.";
  }
}, 20000);
