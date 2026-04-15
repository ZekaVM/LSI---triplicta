document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById("topics-toggle");

  if (!btn) {
    console.log("Button NOT found");
    return;
  }

  console.log("Button found");

  btn.addEventListener("click", function() {
    console.log("CLICK WORKED");
  });
});
