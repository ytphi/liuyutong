document.addEventListener("DOMContentLoaded", () => {
  const tags = document.querySelectorAll(".tags .tag");
  const cards = document.querySelectorAll(".card[data-tags]");
  if (!tags.length || !cards.length) return;

  let active = null;

  tags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const value = tag.dataset.tag;
      active = active === value ? null : value;

      tags.forEach((t) => t.classList.toggle("active", t.dataset.tag === active));
      cards.forEach((card) => {
        const cardTags = card.dataset.tags.split(",");
        const show = !active || cardTags.includes(active);
        card.style.display = show ? "" : "none";
      });
    });
  });
});
