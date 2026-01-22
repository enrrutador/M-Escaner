// search.js
import { getAllProducts } from './indexeddb.js';

export function setupSearch() {
  document.getElementById('searchButton').addEventListener('click', async () => {
    const searchQuery = document.getElementById('searchBar').value.trim().toLowerCase();
    if (searchQuery) {
      const products = await getAllProducts();
      const filteredProducts = products.filter(product =>
        product.barcode.toLowerCase().includes(searchQuery) ||
        product.description.toLowerCase().includes(searchQuery)
      );
      displaySearchResults(filteredProducts);
    } else {
      alert('Por favor, ingrese un término de búsqueda.');
    }
  });

  function displaySearchResults(products) {
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'searchResultsContainer';
    searchResultsContainer.style.display = 'block';

    if (products.length > 0) {
      products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'search-result-item';
        productItem.innerHTML = `
          <h4>${product.description}</h4>
          <p>Código de Barras: ${product.barcode}</p>
          <p>Stock: ${product.stock}</p>
          <p>Precio: $${product.price}</p>
        `;
        searchResultsContainer.appendChild(productItem);
      });
    } else {
      searchResultsContainer.innerHTML = '<p>No se encontraron productos.</p>';
    }

    const existingContainer = document.getElementById('searchResultsContainer');
    if (existingContainer) {
      existingContainer.remove();
    }

    const contentArea = document.querySelector('.content');
    if (contentArea) {
      contentArea.insertBefore(searchResultsContainer, contentArea.children[1]); // Insert after search box
    }
  }
}
