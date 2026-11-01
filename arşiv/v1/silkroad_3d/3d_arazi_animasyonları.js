// 3d_arazi_animasyonları.js

// Three.js ve WebSocket kütüphanelerini dahil edin
import * as THREE from 'three';
import { WebSocket } from 'ws';

// WebGL rendereri oluşturun
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Kamera oluşturun
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Sahne oluşturun
const scene = new THREE.Scene();

// WebSocket bağlantısı oluşturun
const ws = new WebSocket('ws://localhost:8080');

// Korsanların hareketlerini işleyen fonksiyon
function handleKorsanHareketleri(data) {
    // Korsanların pozisyon ve hareket bilgilerini al
    const korsanlar = data.korsanlar;
    
    korsanlar.forEach(korsan => {
        // Korsanın mevcut pozisyonunu al
        const mevcutPozisyon = korsan.pozisyon;
        
        // Korsanın hedef pozisyonunu al
        const hedefPozisyon = korsan.hedefPozisyon;
        
        // Korsanın hızını al
        const hiz = korsan.hiz;
        
        // Korsanın mevcut pozisyonunu ve hedef pozisyonunu kullanarak yeni pozisyon hesaplayın
        const yeniPozisyon = {
            x: mevcutPozisyon.x + (hedefPozisyon.x - mevcutPozisyon.x) * hiz,
            y: mevcutPozisyon.y + (hedefPozisyon.y - mevcutPozisyon.y) * hiz,
            z: mevcutPozisyon.z + (hedefPozisyon.z - mevcutPozisyon.z) * hiz
        };
        
        // Korsanın yeni pozisyonunu güncelle
        korsan.pozisyon = yeniPozisyon;
        
        // Korsanın pozisyonunu render edin
        renderKorsan(korsan);
    });
}

// Korsanı render eden fonksiyon
function renderKorsan(korsan) {
    // Korsanın geometrisini ve malzemesini oluşturun
    const geometri = new THREE.BoxGeometry(1, 1, 1);
    const malzeme = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const korsanMesh = new THREE.Mesh(geometri, malzeme);
    
    // Korsanın pozisyonunu ayarlayın
    korsanMesh.position.set(korsan.pozisyon.x, korsan.pozisyon.y, korsan.pozisyon.z);
    
    // Sahneye korsanı ekleyin
    scene.add(korsanMesh);
}

// WebSocket bağlantısını açın
ws.onopen = () => {
    console.log('WebSocket bağlantısı açıldı');
    
    // Korsan hareketlerini işleyen fonksiyonu WebSocket bağlantısı üzerinden dinleyin
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleKorsanHareketleri(data);
    };
};

// WebSocket bağlantısını kapatın
ws.onclose = () => {
    console.log('WebSocket bağlantısı kapatıldı');
};

// Render döngüsü
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();