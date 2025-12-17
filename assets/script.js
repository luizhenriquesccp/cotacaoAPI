const selectFrom = document.getElementById("from");
const selectTo = document.getElementById("to");
const resultado = document.getElementById("resultado");

async function carregarMoedas() {
  const req = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
  const data = await req.json();

  const moedas = Object.keys(data.rates);

  moedas.forEach(m => {
    const option1 = document.createElement("option");
    const option2 = document.createElement("option");

    option1.value = m;
    option2.value = m;

    option1.textContent = m;
    option2.textContent = m;

    selectFrom.appendChild(option1);
    selectTo.appendChild(option2);
  });

  selectFrom.value = "USD";
  selectTo.value = "BRL";
}

carregarMoedas();

async function converter() {
  const valor = document.getElementById("valor").value;
  const de = selectFrom.value;
  const para = selectTo.value;

  if (!valor) {
    resultado.textContent = "Digite um valor!";
    return;
  }

  const req = await fetch(`https://api.exchangerate-api.com/v4/latest/${de}`);
  const data = await req.json();

  const taxa = data.rates[para];
  const convertido = valor * taxa;

  resultado.textContent = `${valor} ${de} = ${convertido.toFixed(2)} ${para}`;
}

async function TodasasMoedas() {
  const tableBody = document.getElementById("currency-table-body");
  
  if (!tableBody) return;

  try {
    const req = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = await req.json();

    const moedas = data.rates;
    tableBody.innerHTML = ""; 
    const nomesMoedas = {
      USD: "Dólar",
      BRL: "Real Brasileiro",
      EUR: "Euro",
      GBP: "Libra Esterlina",
      JPY: "Iene Japonês",
      CAD: "Dólar Canadense",
      AUD: "Dólar Australiano",
      CHF: "Franco Suíço",
      CNY: "Yuan Chinês",
      INR: "Rupia Indiana",
      MXN: "Peso Mexicano",
      ZAR: "Rand Sul-Africano",
      SEK: "Coroa Sueca",
      NOK: "Coroa Norueguesa",
      DKK: "Coroa Dinamarquesa",
      NZD: "Dólar Neozelandês",
      SGD: "Dólar Singapuriano",
      HKD: "Dólar de Hong Kong",
      KRW: "Won Coreano",
      THB: "Baht Tailandês",
      MYR: "Ringgit Malaio",
      PHP: "Peso Filipino",
      IDR: "Rupia Indonésia",
      VND: "Dong Vietnamita",
      CLP: "Peso Chileno",
      COP: "Peso Colombiano",
      PEN: "Sol Peruano",
      ARS: "Peso Argentino",
      VEF: "Bolívar Venezuelano",
      AED: "Dirham Emiradense",
      SAR: "Rial Saudita",
      AED: "Dirham dos Emirados",
      ILS: "Shequel Israelense",
      TRY: "Lira Turca",
      RUB: "Rublo Russo",
      PKR: "Rupia Paquistanesa",
      BGN: "Lev Búlgaro",
      HRK: "Kuna Croata",
      CZK: "Coroa Tcheca",
      HUF: "Florim Húngaro",
      PLN: "Zloti Polonês",
      RON: "Leu Romeno",
      HNL: "Lempira Hondurenho",
      JMD: "Dólar Jamaicano",
      TTD: "Dólar Trinitário",
      EGP: "Libra Egípcia",
      NGN: "Naira Nigeriana",
      GHS: "Cedi Ganês",
      KES: "Xelim Queniano",
      UGX: "Xelim Ugandense",
    };

    const moedasOrdenadas = Object.entries(moedas)
      .sort((a, b) => b[1] - a[1]); 

    const rateBRL = moedas['BRL'];

    moedasOrdenadas.forEach(([codigo, valor]) => {
      const nomeMoeda = nomesMoedas[codigo] || codigo;

      
      let valorEmBRL = null;
      if (valor && isFinite(valor) && rateBRL && isFinite(rateBRL)) {
        valorEmBRL = rateBRL / valor;
      }

      const displayValor = (valorEmBRL !== null && isFinite(valorEmBRL)) ? valorEmBRL.toFixed(4) : '—';

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${nomeMoeda}</td>
        <td>${codigo}</td>
        <td>${displayValor}</td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Erro ao carregar moedas:", error);
    tableBody.innerHTML = "<tr><td colspan='3' class='text-center'>Erro ao carregar moedas</td></tr>";
  }
}

TodasasMoedas();