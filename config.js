// config.js
//
// Un solo lugar para la URL del backend, usado por login.html e index.html.
// Cuando despliegues el backend en la nube (Render, Railway, etc.), este es
// el ÚNICO archivo que necesitas tocar — antes esta URL estaba repetida a
// mano en login.html y en app.js por separado, lo que obligaba a buscar y
// cambiar en dos sitios distintos cada vez.

const API_BASE = 'https://rubim.onrender.com';
// ⚠️ Cuando despliegues en Render, reemplaza esta línea por algo como:
// const API_BASE = 'https://rubim-backend.onrender.com';
