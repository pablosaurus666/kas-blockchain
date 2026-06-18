const contractAddress = "0xc48E48Da96E7DBa2eF7Ae5006fE0f111732b6D6e";

const contractABI = [
    "function namaHimpunan() public view returns (string)",
    "function totalSuaraMasuk() public view returns (uint256)",
    "function suaraKandidat1() public view returns (uint256)",
    "function suaraKandidat2() public view returns (uint256)",
    "function getDetailSuara(uint256 _index) public view returns (uint256, uint8, uint256)",
    "function coblos(uint8 _pilihan) public"
];

const SEPOLIA_PUBLIC_RPC = "https://rpc.ankr.com/eth_sepolia"; 

let provider, signer, contract;
let votingChart;

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("btnConnect").addEventListener("click", bukaBilikManual);
    document.getElementById("btnCoblos1").addEventListener("click", () => eksekusiCoblos(1));
    document.getElementById("btnCoblos2").addEventListener("click", () => eksekusiCoblos(2));

    initChart();

    try {
        // Mengamankan pembacaan data awal konstan dari RPC Publik
        provider = new ethers.providers.JsonRpcProvider(SEPOLIA_PUBLIC_RPC);
        contract = new ethers.Contract(contractAddress, contractABI, provider);
        
        const votingStatus = document.getElementById("votingStatus");
        votingStatus.innerText = "Mode Pemantau Umum: Menampilkan data real-time langsung dari Blockchain.";
        votingStatus.className = "alert alert-warning py-2 card-custom mb-4 text-center fw-medium text-dark";

        await muatDashboardVoting();

        if (typeof window.ethereum !== "undefined") {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts.length > 0) {
                await aktifkanBilikOtomatis();
            }
        }
    } catch (err) {
        console.error(err);
    }
});

function initChart() {
    const ctx = document.getElementById('chartHasilSuara').getContext('2d');
    votingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Kandidat 01', 'Kandidat 02'],
            datasets: [{
                label: 'Jumlah Perolehan Suara',
                data: [0, 0],
                backgroundColor: ['#198754', '#0d6efd'],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

async function muatDashboardVoting() {
    try {
        if (!contract) return;
        const nama = await contract.namaHimpunan();
        const total = await contract.totalSuaraMasuk();
        const k1 = await contract.suaraKandidat1();
        const k2 = await contract.suaraKandidat2();

        document.getElementById("namaHimpunanLabel").innerText = "Sistem E-Voting " + nama;
        document.getElementById("txtTotalSuara").innerText = total.toString();
        document.getElementById("txtSuaraKandidat1").innerText = k1.toString() + " Suara";
        document.getElementById("txtSuaraKandidat2").innerText = k2.toString() + " Suara";

        if(votingChart) {
            votingChart.data.datasets[0].data = [Number(k1), Number(k2)];
            votingChart.update();
        }

        await muatTabelAudit(Number(total));
    } catch (e) {
        console.error(e);
    }
}

async function bukaBilikManual() {
    if (typeof window.ethereum !== "undefined") {
        try {
            await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
                .then(() => window.ethereum.request({ method: "eth_requestAccounts" }));
            
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = web3Provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            verifikasiDanBukaAksesBilik();
            await muatDashboardVoting();
            alert("Bilik suara digital berhasil dibuka!");
        } catch (e) { alert("Dibatalkan."); }
    } else { alert("Pasang MetaMask!"); }
}

async function aktifkanBilikOtomatis() {
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = web3Provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
    verifikasiDanBukaAksesBilik();
}

function verifikasiDanBukaAksesBilik() {
    document.getElementById("panelBilikSuara").style.display = "block";
    document.getElementById("btnConnect").innerText = "Bilik Terbuka ✅";
    document.getElementById("btnConnect").className = "nav-link text-white bg-success mt-4 text-center border border-success";
    const votingStatus = document.getElementById("votingStatus");
    votingStatus.innerText = "Sesi Bilik Suara Aktif! Otoritas Dompet Panitia Tersemat.";
    votingStatus.className = "alert alert-success py-2 card-custom mb-4 text-center fw-medium";
}

async function muatTabelAudit(totalSuara) {
    const tabel = document.getElementById("tabelSuara");
    tabel.innerHTML = "";
    for (let i = totalSuara - 1; i >= 0; i--) {
        try {
            const dataSuara = await contract.getDetailSuara(i);
            let badgePilihan = dataSuara[1] === 1 ? '<span class="badge bg-success">Kandidat 01</span>' : '<span class="badge bg-primary">Kandidat 02</span>';
            let waktuLokal = new Date(Number(dataSuara[2]) * 1000).toLocaleString('id-ID');
            tabel.innerHTML += `<tr><td class="fw-bold">#${dataSuara[0]}</td><td>${badgePilihan}</td><td>${waktuLokal}</td><td><span class="badge bg-secondary">Immutable Block Verified</span></td></tr>`;
        } catch (err) { console.error(err); }
    }
}

async function eksekusiCoblos(nomorKandidat) {
    if (!signer) return alert("Bilik belum sah!");
    let konfirmasi = confirm(`Apakah Anda yakin memilih Kandidat 0${nomorKandidat}?`);
    if (!konfirmasi) return;
    try {
        alert("Mengunci pilihan... Konfirmasi di MetaMask Panitia.");
        const tx = await contract.coblos(nomorKandidat);
        alert("Menunggu konfirmasi blok validator...");
        await tx.wait();
        alert("Suara Anda berhasil disimpan!");
        location.reload();
    } catch (error) { console.error(error); alert("Gagal memproses suara."); }
}