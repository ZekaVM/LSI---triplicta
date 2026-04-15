$(document).ready(function() {

  $(document).on("click", "#topics-toggle", function(e) {
    e.stopPropagation(); // prevents immediate closing
    $(".side-nav").toggleClass("active");
  });

  $(document).on("click", function(e) {
    const sidebar = $(".side-nav");

    if (
      sidebar.hasClass("active") &&
      !$(e.target).closest(".side-nav").length &&
      !$(e.target).closest("#topics-toggle").length
    ) {
      sidebar.removeClass("active");
    }
  });

});
