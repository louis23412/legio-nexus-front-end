import os from 'os';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const interfaces = os.networkInterfaces();
let ipAddress;

Object.keys(interfaces).forEach((ifaceName) => {
  interfaces[ifaceName].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      ipAddress = iface.address;
    }
  });
});

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],

  server: {
    port: 3010,
    host: ipAddress,
    strictPort: true
  },

  define : {
    'import.meta.env.localIp' : JSON.stringify(ipAddress)
  }
})