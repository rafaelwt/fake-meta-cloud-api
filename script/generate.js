import fs from 'fs';
import path from 'path';

// Cantidad recibida como parámetro
// Ejemplo: node generate-phone-csv.js 500
const cantidadRegistros = parseInt(process.argv[2], 10);

// Validación mínima
if (isNaN(cantidadRegistros) || cantidadRegistros <= 0) {
  console.error('Error: debes enviar una cantidad válida. Ej: node generate-phone-csv.js 300');
  process.exit(1);
}

const filename = path.join('docs', 'data', 'phone.csv');

// Crear carpetas si no existen
fs.mkdirSync(path.dirname(filename), { recursive: true });

let csv = 'phone,cantidad\n';

for (let i = 0; i < cantidadRegistros; i++) {
  const prefix = Math.random() < 0.5 ? 6 : 7;
  const number = `+8812${prefix}${Math.floor(1000000 + Math.random() * 9000000)}`;
  const cant = Math.floor(1 + Math.random() * 5); // 1 a 5

  csv += `${number},${cant}\n`;
}

fs.writeFileSync(filename, csv, 'utf8');

console.log(`CSV generado con ${cantidadRegistros} filas en: ${filename}`);
