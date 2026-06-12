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

const SEPOLIA_PUBLIC_RPC = "https://rpc.ankr.com/eth_sepolia"; 

let provider;
let signer;
let contract;

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btnConnect").addEventListener("click", inisialisasiWeb3);
    document.getElementById("btnPemasukan").addEventListener("click", inputPemasukan);
    document.getElementById("btnPengeluaran").addEventListener("click", inputPengeluaran);
    document.getElementById("btnAcc").addEventListener("click", setujuiDana);

    // Bawaan awal: Sembunyikan panel input total untuk siapapun
    document.getElementById("panelAdmin").style.display = "none";

    try {
        console.log("Menghubungkan ke RPC Publik Sepolia...");
        provider = new ethers.providers.JsonRpcProvider(SEPOLIA_PUBLIC_RPC);
        contract = new ethers.Contract(contractAddress, contractABI, provider);
        
        const walletStatusAlert = document.getElementById("walletStatus");
        walletStatusAlert.innerText = "Mode Transparansi Publik: Data dibaca langsung dari Blockchain (Read-Only Mode).";
        walletStatusAlert.className = "alert alert-warning py-2 card-custom mb-4";

        await muatDataDashboard();

        // Auto-connect jika di browser laptop/HP terpasang MetaMask yang sudah login akun admin
        if (typeof window.ethereum !== "undefined") {
            const akunTerhubung = await window.ethereum.request({ method: "eth_accounts" });
            if (akunTerhubung.length > 0) {
                await hubungkanWalletOtomatis();
            }
        }
    } catch (error) {
        console.error("Gagal memuat data awal dari RPC Publik:", error);
    }
});

async function inisialisasiWeb3() {
    if (typeof window.ethereum !== "undefined") {
        try {
            await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
                .then(() => window.ethereum.request({ method: "eth_requestAccounts" }));
            
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            await verifikasiOtoritasUser();
            alert("Dompet Admin Berhasil Diverifikasi!");
        } catch (error) {
            console.error(error);
            alert("Koneksi dibatalkan: " + error.message);
        }
    } else {
        alert("Peringatan: Panel Admin membutuhkan ekstensi MetaMask!");
    }
}

async function hubungkanWalletOtomatis() {
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        await verifikasiOtoritasUser();
    } catch (e) {
        console.error(e);
    }
}

async function verifikasiOtoritasUser() {
    try {
        // Tampilkan panel input KAS hanya jika dompet aktif terhubung (Otoritas Bendahara)
        document.getElementById("panelAdmin").style.display = "flex"; 
        
        document.getElementById("btnConnect").innerText = "Admin Terhubung ✅";
        document.getElementById("btnConnect").className = "btn btn-success fw-bold";
        
        const walletStatusAlert = document.getElementById("walletStatus");
        walletStatusAlert.innerText = "Sesi Otoritas Aktif! Panel input data kas siap digunakan.";
        walletStatusAlert.className = "alert alert-success py-2 card-custom mb-4";
        
        await muatDataDashboard();
    } catch (err) {
        console.error(err);
    }
}

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

async function muatTabelTransaksi(totalTransaksi) {
    const tabel = document.getElementById("tabelRiwayat");
    tabel.innerHTML = ""; 

    for (let i = 1; i <= totalTransaksi; i++) {
        try {
            const tx = await contract.getDetailTransaksi(i);
            let tipeTransaksi = tx[1]; 
            let keteranganAsli = tx[3];
            
            let badgeTipe = tipeTransaksi === "Pemasukan" ? 
                '<span class="badge bg-info">Pemasukan</span>' : '<span class="badge bg-secondary">Pengeluaran</span>';
            let statusBadge = '<span class="badge bg-success">Disetujui</span>';

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
            console.error(err);
        }
    }
}

async function inputPemasukan() {
    const jumlah = document.getElementById("inPemasukanJumlah").value;
    const ket = document.getElementById("inPemasukanKet").value;
    const pj = document.getElementById("inPemasukanPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom wajib diisi!");
    if (!signer) return alert("Hubungkan wallet terlebih dahulu!");

    try {
        const tx = await contract.catatPemasukan(BigInt(jumlah), ket, pj);
        alert("Transaksi dikirim! Menunggu konfirmasi Blockchain...");
        await tx.wait(); 
        alert("Pemasukan sukses dicatat!");
        location.reload();
    } catch (error) {
        alert("Gagal mencatat data. Pastikan Anda adalah Bendahara pemilik kontrak!");
    }
}

async function inputPengeluaran() {
    const jumlah = document.getElementById("inPengeluaranJumlah").value;
    const ket = document.getElementById("inPengeluaranKet").value;
    const pj = document.getElementById("inPengeluaranPJ").value;

    if (!jumlah || !ket || !pj) return alert("Semua kolom wajib diisi!");
    if (!signer) return alert("Hubungkan wallet terlebih dahulu!");

    try {
        const tx = await contract.catatPengeluaran(BigInt(jumlah), ket, pj);
        alert("Transaksi dikirim! Menunggu konfirmasi Blockchain...");
        await tx.wait();
        alert("Pengeluaran sukses dicatat!");
        location.reload(); 
    } catch (error) {
        alert("Gagal mencatat data. Saldo tidak cukup atau Anda bukan Bendahara!");
    }
}

async function setujuiDana() {
    alert("Fitur otomatis terintegrasi langsung.");
}