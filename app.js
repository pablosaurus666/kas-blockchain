// 1. ATUR KONFIGURASI DAN PROVIDER UTAMA
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

// Pipa RPC Publik Sepolia agar orang tanpa MetaMask bisa membaca data blockchain secara gratis
const SEPOLIA_PUBLIC_RPC = "https://rpc.ankr.com/eth_sepolia"; 

let provider;
let signer;
let contract;

// 2. OTOMATISASI SAAT WEB DIBUKA (Mendukung Pengunjung Umum / Tanpa MetaMask)
window.addEventListener("DOMContentLoaded", async () => {
    // Daftarkan event listener tombol aksi
    document.getElementById("btnConnect").addEventListener("click", inisialisasiWeb3);
    document.getElementById("btnPemasukan").addEventListener("click", inputPemasukan);
    document.getElementById("btnPengeluaran").addEventListener("click", inputPengeluaran);
    document.getElementById("btnAcc").addEventListener("click", setujuiDana);

    // Langkah awal: Muat data menggunakan RPC Publik (Mode Transparansi Publik)
    try {
        console.log("Menghubungkan ke RPC Publik Sepolia...");
        provider = new ethers.providers.JsonRpcProvider(SEPOLIA_PUBLIC_RPC);
        contract = new ethers.Contract(contractAddress, contractABI, provider);
        
        // Atur status interface default untuk umum (Read-Only)
        const walletStatusAlert = document.getElementById("walletStatus");
        walletStatusAlert.innerText = "Mode Transparansi: Anda melihat data langsung dari Blockchain (Read-Only).";
        walletStatusAlert.className = "alert alert-warning py-2 card-custom mb-4"; // Warna kuning (peringatan/viewer)
        
        // Kunci kolom input untuk umum
        setFormStatus(true);

        // Ambil data saldo dan tabel riwayat untuk ditampilkan ke publik
        await muatDataDashboard();

        // LOGIKA KEDUA: Jika ternyata browser memiliki MetaMask dan wallet-nya aktif terhubung,
        // otomatis naikkan level ke mode transaksi (Auto-Connect untuk Bendahara)
        if (typeof window.ethereum !== "undefined") {
            const akunTerhubung = await window.ethereum.request({ method: "eth_accounts" });
            if (akunTerhubung.length > 0) {
                console.log("Wallet aktif terdeteksi. Mengaktifkan fitur otoritas...");
                await hubungkanWalletOtomatis();
            }
        }
    } catch (error) {
        console.error("Gagal memuat data awal dari RPC Publik:", error);
    }
});

// 3. FUNGSI LOGIN / KONEKSI WALLET MANUAL (DIKLIK OLEH BENDAHARA)
async function inisialisasiWeb3() {
    if (typeof window.ethereum !== "undefined") {
        try {
            // Meminta izin akses akun MetaMask
            await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
                .then(() => window.ethereum.request({ method: "eth_requestAccounts" }));
            
            // Setel ulang provider menggunakan MetaMask (Web3Provider) agar bisa menulis data (Write)
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Jalankan verifikasi apakah yang login adalah Bendahara sah
            await verifikasiOtoritasUser();
            alert("MetaMask berhasil terhubung!");
        } catch (error) {
            console.error(error);
            alert("Koneksi dibatalkan atau terjadi kesalahan: " + error.message);
        }
    } else {
        alert("MetaMask tidak ditemukan! Silakan gunakan browser yang mendukung Web3 atau buka lewat dApp Browser MetaMask.");
    }
}

// Fungsi pembantu untuk memproses Auto-Connect internal
async function hubungkanWalletOtomatis() {
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        await verifikasiOtoritasUser();
    } catch (e) {
        console.error("Gagal melakukan auto-connect:", e);
    }
}

// Fungsi untuk memeriksa alamat user yang login vs sistem keamanan
async function verifikasiOtoritasUser() {
    try {
        const alamatUser = await signer.getAddress();
        
        // Berhubung di contractABI fungsi bendahara() tidak dipasang, kita langsung buka form 
        // Jika kamu ingin proteksi ketat, pastikan fungsi "bendahara" ada di ABI.
        document.getElementById("btnConnect").innerText = "Wallet Terhubung ✅";
        document.getElementById("btnConnect").className = "btn btn-success fw-bold";
        
        const walletStatusAlert = document.getElementById("walletStatus");
        walletStatusAlert.innerText = "Sistem Siap! Sesi dompet kripto aktif. Pastikan Anda memiliki otoritas Bendahara untuk merubah data.";
        walletStatusAlert.className = "alert alert-success py-2 card-custom mb-4";
        
        setFormStatus(false); // Buka kunci form karena wallet aktif mendampingi
        await muatDataDashboard();
    } catch (err) {
        console.error(err);
    }
}

// Fungsi pembantu untuk mengunci atau membuka panel input HTML
function setFormStatus(isLocked) {
    document.getElementById("inPemasukanJumlah").disabled = isLocked;
    document.getElementById("inPemasukanKet").disabled = isLocked;
    document.getElementById("inPemasukanPJ").disabled = isLocked;
    document.getElementById("btnPemasukan").className = isLocked ? "btn btn-secondary w-100 disabled" : "btn btn-success w-100";
    
    document.getElementById("inPengeluaranJumlah").disabled = isLocked;
    document.getElementById("inPengeluaranKet").disabled = isLocked;
    document.getElementById("inPengeluaranPJ").disabled = isLocked;
    document.getElementById("btnPengeluaran").className = isLocked ? "btn btn-secondary w-100 disabled" : "btn btn-danger w-100";
}

// 4. FUNGSI UNTUK MEMBACA DATA & MENAMPILKAN KE DASHBOARD
async function muatDataDashboard() {
    try {
        if (!contract) return;

        const nama = await contract.namaHimpunan();
        const saldo = await contract.totalSaldo();
        const totalTx = await contract.counterTransaksi();

        document.getElementById("namaHimpunanLabel").innerText = "Sistem Kas " + nama;
        document.getElementById("txtTotalSaldo").innerText = "Rp " + Number(saldo).toLocaleString('id-ID');
        document.getElementById("txtTotalTransaksi").innerText = totalTx.toString();

        await muatTabelTransaksi(Number(totalTx));

    } catch (error) {
        console.error("Gagal mengambil data kas:", error);
    }
}

// 5. FUNGSI MEMUAT RIWAYAT TRANSAKSI KE TABEL HTML
async function muatTabelTransaksi(totalTransaksi) {
    const tabel = document.getElementById("tabelRiwayat");
    tabel.innerHTML = ""; 

    for (let i = 1; i <= totalTransaksi; i++) {
        try {
            const tx = await contract.getDetailTransaksi(i);
            let tipeTransaksi = tx[1]; 
            let keteranganAsli = tx[3];
            
            let badgeTipe = "";
            let statusBadge = "";

            if (tipeTransaksi === "Pemasukan") {
                badgeTipe = '<span class="badge bg-info">Pemasukan</span>';
                statusBadge = '<span class="badge bg-success">Disetujui</span>';
            } else {
                badgeTipe = '<span class="badge bg-secondary">Pengeluaran</span>';
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

// 6. FUNGSI UNTUK TOMBOL INPUT PEMASUKAN
async function inputPemasukan() {
    const jumlah = document.getElementById("inPemasukanJumlah").value;
    const ket = document.getElementById("inPemasukanKet").value;
    const pj = document.getElementById("inPemasukanPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom pemasukan wajib diisi!");
    if (!signer) return alert("Silakan hubungkan wallet MetaMask Anda terlebih dahulu!");

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

// 7. FUNGSI UNTUK TOMBOL INPUT PENGELUARAN
async function inputPengeluaran() {
    const jumlah = document.getElementById("inPengeluaranJumlah").value;
    const ket = document.getElementById("inPengeluaranKet").value;
    const pj = document.getElementById("inPengeluaranPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom pengeluaran wajib diisi!");
    if (!signer) return alert("Silakan hubungkan wallet MetaMask Anda terlebih dahulu!");

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

// 8. FUNGSI ACC (DINONAKTIFKAN KARENA KONTRAK MENGGUNAKAN SISTEM POTONG LANGSUNG)
async function setujuiDana() {
    alert("Fitur ACC dinonaktifkan: Kontrak pintar versi ini menggunakan sistem pencatatan langsung oleh Bendahara.");
}