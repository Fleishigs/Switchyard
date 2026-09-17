const controls = document.querySelector('#catalogue-controls');
const search = document.querySelector('#tool-search');
const category = document.querySelector('#tool-category');
const cards = [...document.querySelectorAll('.tool')];
for (const name of new Set(cards.map(card => card.dataset.category))) {
  const option = document.createElement('option');
  option.value = option.textContent = name;
  category.append(option);
}
function filter() {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const card of cards) {
    card.hidden = Boolean((category.value && card.dataset.category !== category.value) || !card.textContent.toLocaleLowerCase().includes(query));
    if (!card.hidden) count++;
  }
  document.querySelector('#tool-count').textContent = `${count} of ${cards.length} tools`;
  document.querySelector('#no-results').hidden = count !== 0;
}
controls.hidden = false;
search.addEventListener('input', filter);
category.addEventListener('change', filter);
filter();
