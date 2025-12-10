const map = L.map('map').setView([19.432672, -99.133062], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 12,
    maxZoom: 19,
}).addTo(map);

map.locate({enableHighAccuracy:true});

//encontrar ubicación
map.on('locationfound', e => {
    const coords = [e.latlng.lat, e.latlng.lng];
    const marker = L.marker(coords);
    marker.bindPopup('Te encuentras aquí');
    map.addLayer(marker);
    // socket.emit('userCoordinates', coords); // Comentado: Socket.IO no está configurado
});

var marcador = L.marker([19.293928, -99.015089]).addTo(map);
marcador.bindPopup('Desesperanza A.C.').openPopup();



// socket.on('userNewCoordinates',(coords)=>{
// 	console.log('nuevo usuario conectado');
// 	const marker=L.marker([52,-0.9]);
// 	marker.bindPopup('Hola');
// 	map.addLayer(marker);
// });