const contractAddress = "0xAC00Ad360FfF10e906fF99F8C91A7e0884fB6592";

const contractABI = [
    "function namaHimpunan() public view returns (string)",
    "function totalSaldo() public view returns (uint256)",
    "function counterTransaksi() public view returns (uint256)",
    "function getDetailTransaksi(uint256 _id) public view returns (uint256, string, uint256, string, string, uint256)",
    "function riwayatTransaksi(uint256) public view returns (uint256 id, uint8 tipe, uint256 jumlah, string keterangan, string penanggungJawab, uint256 tanggal)",
    "function catatPemasukan(uint256 _jumlah, string memory _keterangan, string memory _pembayar) public",
    "function catatPengeluaran(uint256 _jumlah, string memory _keterangan, string memory _pjProker) public"
];

let provider;
let signer;
let contract;

// 2. FUNGSI UTAMA: MENYAMBUNGKAN KE METAMASK & BLOCKCHAIN
async function inisialisasiWeb3() {
    if (typeof window.ethereum !== "undefined") {
        try {
            const accounts = await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
                .then(() => window.ethereum.request({ method: "eth_requestAccounts" }));
            
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            document.getElementById("btnConnect").innerText = "Wallet Terhubung ✅";
            document.getElementById("btnConnect").className = "btn btn-success fw-bold";
            
            muatDataDashboard();
            alert("MetaMask berhasil terhubung!");
        } catch (error) {
            console.error(error);
            alert("Koneksi dibatalkan atau terjadi kesalahan: " + error.message);
        }
    } else {
        alert("MetaMask tidak ditemukan!");
    }
}

// 3. FUNGSI UNTUK MEMBACA DATA & MENAMPILKAN KE DASHBOARD
async function muatDataDashboard() {
    try {
        if (!contract) return;

        const nama = await contract.namaHimpunan();
        const saldo = await contract.totalSaldo();
        const totalTx = await contract.counterTransaksi();

        document.getElementById("namaHimpunanLabel").innerText = "Sistem Kas " + nama;
        document.getElementById("txtTotalSaldo").innerText = "Rp " + Number(saldo).toLocaleString('id-ID');
        document.getElementById("txtTotalTransaksi").innerText = totalTx.toString();

        muatTabelTransaksi(Number(totalTx));

    } catch (error) {
        console.error("Gagal mengambil data kas:", error);
    }
}

// 4. FUNGSI MEMUAT RIWAYAT TRANSAKSI KE TABEL HTML
async function muatTabelTransaksi(totalTransaksi) {
    const tabel = document.getElementById("tabelRiwayat");
    tabel.innerHTML = ""; 

    for (let i = 1; i <= totalTransaksi; i++) {
        try {
            const tx = await contract.getDetailTransaksi(i);
            let tipeTransaksi = tx[1]; 
            let keteranganAsli = tx[3];
            
            // Mengatur badge warna secara dinamis berdasarkan data asli blockchain
            let badgeTipe = "";
            let statusBadge = "";

            if (tipeTransaksi === "Pemasukan") {
                badgeTipe = '<span class="badge bg-info">Pemasukan</span>';
                statusBadge = '<span class="badge bg-success">Disetujui</span>';
            } else {
                badgeTipe = '<span class="badge bg-secondary">Pengeluaran</span>';
                // Karena tipe pengeluaran di kontrak barumu langsung memotong saldo, statusnya otomatis sukses/disetujui
                statusBadge = '<span class="badge bg-success">Disetujui</span>'; 
            }

            let baris = `
                <tr>
                    <td>${tx[0]}</td>
                    <td>${badgeTipe}</td>
                    <td>Rp ${Number(tx[2]).toLocaleString('id-ID')}</td>
                    <td>${keteranganAsli}</td>
                    <td>${tx[4]}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
            tabel.innerHTML += baris;
        } catch (err) {
            console.error("Gagal memuat transaksi ID " + i, err);
        }
    }
}

// 5. FUNGSI UNTUK TOMBOL INPUT PEMASUKAN
async function inputPemasukan() {
    const jumlah = document.getElementById("inPemasukanJumlah").value;
    const ket = document.getElementById("inPemasukanKet").value;
    const pj = document.getElementById("inPemasukanPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom pemasukan wajib diisi!");

    try {
        const nilaiPemasukan = BigInt(jumlah);
        alert("Menghubungi Blockchain... Silakan konfirmasi di MetaMask Anda.");
        
        const tx = await contract.catatPemasukan(nilaiPemasukan, ket, pj);
        alert("Transaksi dikirim! Menunggu konfirmasi Blockchain...");
        
        await tx.wait(); 
        alert("Pemasukan berhasil dicatat!");
        location.reload();
    } catch (error) {
        alert("Gagal mencatat pemasukan. Pastikan nominal valid dan Anda menggunakan akun Bendahara yang sah!");
        console.error(error);
    }
}

// 6. FUNGSI UNTUK TOMBOL INPUT PENGELUARAN
async function inputPengeluaran() {
    const jumlah = document.getElementById("inPengeluaranJumlah").value;
    const ket = document.getElementById("inPengeluaranKet").value;
    const pj = document.getElementById("inPengeluaranPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom pengeluaran wajib diisi!");

    try {
        const nilaiPengeluaran = BigInt(jumlah);
        alert("Menghubungi Blockchain... Silakan konfirmasi di MetaMask Anda.");

        const tx = await contract.catatPengeluaran(nilaiPengeluaran, ket, pj);
        alert("Transaksi dikirim! Menunggu konfirmasi Blockchain...");
        
        await tx.wait();
        alert("Pengeluaran anggaran berhasil dicatat secara resmi!");
        location.reload(); 
    } catch (error) {
        console.error("Detail Error:", error);
        alert("Gagal mencatat pengeluaran. Pastikan nominal tidak melebihi saldo kas aktif atau Anda menggunakan akun Bendahara yang sah!");
    }
}

// 7. FUNGSI UTK FITUR ACC (DINONAKTIFKAN KARENA KONTRAK MENGGUNAKAN SISTEM POTONG LANGSUNG)
async function setujuiDana() {
    alert("Fitur ACC dinonaktifkan: Kontrak pintar versi ini menggunakan sistem pencatatan langsung oleh Bendahara.");
}

// 8. PASANG EVENT LISTENER & OTOMATISASI KONEKSI WALLET (FIX VISUAL ALERT)
window.addEventListener("DOMContentLoaded", async () => {
    // Daftarkan aksi klik manual tombol tetap berfungsi seperti biasa
    document.getElementById("btnConnect").addEventListener("click", inisialisasiWeb3);
    document.getElementById("btnPemasukan").addEventListener("click", inputPemasukan);
    document.getElementById("btnPengeluaran").addEventListener("click", inputPengeluaran);
    document.getElementById("btnAcc").addEventListener("click", setujuiDana);

    // LOGIKA AUTO-CONNECT
    if (typeof window.ethereum !== "undefined") {
        try {
            const akunTerhubung = await window.ethereum.request({ method: "eth_accounts" });
            if (akunTerhubung.length > 0) {
                console.log("Wallet terdeteksi aktif. Melakukan auto-connect...");
                
                provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
                contract = new ethers.Contract(contractAddress, contractABI, signer);
                
                // 1. Perbarui tampilan Tombol Utama
                document.getElementById("btnConnect").innerText = "Wallet Terhubung ✅";
                document.getElementById("btnConnect").className = "btn btn-success fw-bold";
                
                // 2. BARIS PERBAIKAN: Perbarui teks & warna kotak alert panjang di bawahnya agar ikut sinkron!
                const walletStatusAlert = document.getElementById("walletStatus");
                walletStatusAlert.innerText = "Sistem Siap! Anda terhubung menggunakan otoritas Bendahara yang sah.";
                walletStatusAlert.className = "alert alert-success py-2 card-custom mb-4"; // Ubah dari alert-info (biru) ke alert-success (hijau)
                
                // Muat data dashboard kas
                muatDataDashboard();
            }
        } catch (error) {
            console.error("Gagal menjalankan sistem auto-connect:", error);
        }
    }
});