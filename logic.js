// ------------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ -------------------------
let regionsData = [];
let map = null;
let historyEntries = [];

// ------------------------- ЗАГРУЗКА ДАННЫХ -------------------------
async function loadRegions() {
    try {
        const response = await fetch('par.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        regionsData = data.regions;
        console.log(`✅ Загружено регионов: ${regionsData.length}`);
    } catch (err) {
        console.error(err);
        alert("Ошибка загрузки par (1).json. Убедитесь, что файл в той же папке и вы используете локальный сервер.");
    }
}
window.onload = () => {
    loadRegions();
    loadHistoryFromStorage();
    renderHistoryPanel();
};

// ------------------------- РАСЧЁТ ПЛОЩАДЕЙ И СМЕТЫ (по ТЗ п.6) -------------------------
function calculateConstruction(volume, employees, housingPct, housingType, kinderPlaces, sportsList) {
    // Площади по формулам ТЗ (п.6.2) с реалистичными коэффициентами
    const workshopArea = volume * 0.4;               // 0.4 м² на тыс. м²/год
    const warehouseArea = workshopArea * 0.35;
    const adminArea = workshopArea * 0.02;
    const parkingArea = employees * 0.5 * 25;
    const roadsArea = (workshopArea + warehouseArea) * 0.25;

    // Жильё
    let housingArea = 0;
    if (housingPct > 0) {
        const perPerson = (housingType === "Общежитие") ? 25 : 40;
        housingArea = employees * (housingPct / 100) * perPerson;
    }
    const kindergartenArea = (employees / 100) * kinderPlaces * 15;
    const diningArea = employees * 0.5;
    const medicalArea = Math.max(employees * 0.1, 20);

    const areas = {
        "Цех": Math.round(workshopArea),
        "Склад": Math.round(warehouseArea),
        "АБК": Math.round(adminArea),
        "Парковка": Math.round(parkingArea),
        "Дороги": Math.round(roadsArea),
        "Жильё": Math.round(housingArea),
        "Детский сад": Math.round(kindergartenArea),
        "Столовая": Math.round(diningArea),
        "Медпункт": Math.round(medicalArea)
    };

    // Укрупнённая смета (руб/м²) из ТЗ п.6.3 (реалистичные цены для региона)
    const costPerSq = {
        "Цех": 35000, "Склад": 35000, "АБК": 55000,
        "Жильё_общежитие": 70000, "Жильё_квартиры": 90000,
        "Детский сад": 50000, "Столовая": 35000, "Медпункт": 45000,
        "Дороги": 5000, "Парковка": 5000
    };

    let constructionCost = 0;
    constructionCost += workshopArea * costPerSq["Цех"];
    constructionCost += warehouseArea * costPerSq["Склад"];
    constructionCost += adminArea * costPerSq["АБК"];
    constructionCost += roadsArea * costPerSq["Дороги"];
    constructionCost += parkingArea * costPerSq["Парковка"];

    const housingCostPer = (housingType === "Общежитие") ? costPerSq["Жильё_общежитие"] : costPerSq["Жильё_квартиры"];
    constructionCost += housingArea * housingCostPer;
    constructionCost += kindergartenArea * costPerSq["Детский сад"];
    constructionCost += diningArea * costPerSq["Столовая"];
    constructionCost += medicalArea * costPerSq["Медпункт"];

    // Спорт (штучно)
    const sportsPrices = { "Стадион": 5e6, "Бассейн": 8e6, "Спортзал": 3e6, "Хоккейная коробка": 2e6 };
    let sportsCost = 0;
    (sportsList || []).forEach(s => { if (sportsPrices[s]) sportsCost += sportsPrices[s]; });

    // Благоустройство (2000 руб/м² на 25% от застроенной площади)
    const totalBuiltArea = workshopArea + warehouseArea + adminArea + parkingArea + roadsArea + housingArea + kindergartenArea + diningArea + medicalArea;
    const landscapingArea = totalBuiltArea * 0.25;
    const landscapingCost = landscapingArea * 2000;

    const totalConstruction = constructionCost + sportsCost + landscapingCost;

    return {
        areas,
        constructionCost: totalConstruction,
        sportsCost,
        landscapingCost,
        totalBuiltArea,
        landscapingArea
    };
}

// ------------------------- РАНЖИРОВАНИЕ РЕГИОНОВ (ТОП-3) -------------------------
function rankTop3(budgetMln, needRail, maxHighway, userParams) {
    if (!regionsData.length) return [];
    const budgetRub = budgetMln * 1_000_000;

    const scored = regionsData.map(region => {
        if (!region.sites || region.sites.length === 0) return null;
        // Выбираем участок с максимальной свободной мощностью
        const bestSite = region.sites.reduce((best, site) => {
            const power = site["4.4_infrastructure"]?.free_power_kva || 0;
            return power > (best?.free_power_kva || 0) ? site : best;
        }, region.sites[0]);
        const infra = bestSite["4.4_infrastructure"];
        const log = region["4.1_logistics"];
        const econ = region["4.3_economics"];
        const social = region["4.2_social"];

        // Логистика
        const avgDist = (log.steel_distance_to_plant_km + log.insulation_distance_to_plant_km) / 2;
        let logScore = Math.max(0, 1 - avgDist / 2000);
        if (needRail === "true" && !bestSite.rail_available) logScore *= 0.7;

        // Экономика
        let econScore = 0;
        const tariffScore = Math.max(0, 1 - econ.energy_tariff_rub_per_kwh / 10) * 0.5;
        econScore += tariffScore;
        if (econ.tax_incentives && (econ.tax_incentives.includes("ОЭЗ") || econ.tax_incentives.includes("ТОР"))) econScore += 0.3;
        if (econ.insurance_reduction) econScore += 0.2;
        econScore = Math.min(1, econScore);

        // Инфраструктура участка
        let infraScore = 0;
        if (infra.gas_available) infraScore += 0.2;
        const powerOk = (infra.free_power_kva >= 800) ? 0.3 : 0.1;
        infraScore += powerOk;
        const priceConnectNorm = Math.max(0, 1 - infra.grid_connection_price_rub_per_kw / 8000);
        infraScore += priceConnectNorm * 0.3;

        // Социальный блок
        let socialScore = 0;
        const kindergartensNorm = social.kindergartens_per_100_children / 100;
        socialScore += kindergartensNorm * 0.15;
        const collegesNorm = Math.min(1, social.vocational_colleges_count / 30);
        socialScore += collegesNorm * 0.15;
        const rentNorm = Math.max(0, 1 - social.rent_1room_avg_rub / 60000);
        socialScore += rentNorm * 0.1;

        // Бюджет
        const sitePrice = bestSite.price_rub || 0;
        const connCost = infra.free_power_kva * infra.grid_connection_price_rub_per_kw;
        const totalLandConn = sitePrice + connCost;
        let budgetOk = (totalLandConn <= budgetRub) ? 1.0 : 0.4;

        const total = logScore * 0.25 + econScore * 0.25 + infraScore * 0.2 + socialScore * 0.15 + budgetOk * 0.15;
        return {
            name: region.name,
            coords: region.coords,
            score: total,
            site: bestSite,
            infra,
            log,
            econ,
            social,
            cultural: region["4.5_cultural_code"],
            totalLandConn,
            budgetOk
        };
    }).filter(r => r !== null);

    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0,3);
}

// ------------------------- ФОРМИРОВАНИЕ ОТЧЁТОВ ДЛЯ ТОП-3 -------------------------
function generateRegionReport(region, constructionData, userParams) {
    const areasTable = Object.entries(constructionData.areas).map(([k,v]) => `<tr><td>${k}</td><td class="text-end">${v.toLocaleString()} м²</td></tr>`).join('');
    const totalConstRub = constructionData.constructionCost.toLocaleString('ru-RU');
    const landConnRub = region.totalLandConn.toLocaleString('ru-RU');
    const totalProject = (constructionData.constructionCost + region.totalLandConn).toLocaleString('ru-RU');
    return `
        <div class="card mt-4">
            <div class="card-header bg-white fw-bold">🏆 ${region.name}</div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>📐 Площади объектов</h6>
                        <table class="table table-sm table-bordered">${areasTable}</table>
                    </div>
                    <div class="col-md-6">
                        <h6>💰 Смета</h6>
                        <table class="table table-sm">
                            <tr><td>Строительство (объекты+спорт+благоустр.)</td><td class="text-end">${totalConstRub} ₽</td></tr>
                            <tr><td>Участок + техприсоединение</td><td class="text-end">${landConnRub} ₽</td></tr>
                            <tr class="fw-bold"><td>ИТОГО по проекту</td><td class="text-end">${totalProject} ₽</td></tr>
                        </table>
                    </div>
                </div>
                <hr>
                <div class="row">
                    <div class="col-md-6">
                        <h6>📊 Аналитическая справка</h6>
                        <ul class="small">
                            <li>🏭 Логистика: сталь ${region.log.steel_distance_to_plant_km} км, утеплитель ${region.log.insulation_distance_to_plant_km} км</li>
                            <li>⚡ Энерготариф: ${region.econ.energy_tariff_rub_per_kwh} руб/кВт·ч, льготы: ${region.econ.tax_incentives || "нет"}</li>
                            <li>💡 Свободная мощность: ${region.infra.free_power_kva} кВА, газ: ${region.infra.gas_available ? "да" : "нет"}</li>
                            <li>👥 Социал: детсады ${region.social.kindergartens_per_100_children} мест/100 детей, аренда ${region.social.rent_1room_avg_rub} ₽</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h6>🎨 Культурный код (для рендеров)</h6>
                        <p class="small">Стили: ${region.cultural?.architecture_styles?.join(", ") || "—"}<br>Материалы: ${region.cultural?.traditional_materials?.join(", ") || "—"}<br>Цвета: ${region.cultural?.color_profile?.join(", ") || "—"}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ------------------------- ОСНОВНОЙ РАСЧЁТ И ОТОБРАЖЕНИЕ -------------------------
function calculateAndRank() {
    if (!regionsData.length) {
        alert("Данные регионов ещё не загружены. Попробуйте через секунду.");
        return;
    }
    // Сбор данных из формы
    const volume = parseFloat(document.getElementById('volume').value);
    const employees = parseFloat(document.getElementById('employees').value);
    const budget = parseFloat(document.getElementById('budget').value);
    const needRail = document.getElementById('need_rail').value;
    const maxHighway = parseFloat(document.getElementById('max_highway').value);
    const archStyle = document.getElementById('arch_style').value;
    const housingPct = parseFloat(document.getElementById('housing_pct').value);
    const housingType = document.getElementById('housing_type').value;
    const kinderPlaces = parseFloat(document.getElementById('kinder_places').value);
    const sportsList = Array.from(document.querySelectorAll('.sports:checked')).map(cb => cb.value);
    const landscapingList = Array.from(document.querySelectorAll('.landscaping:checked')).map(cb => cb.value);

    // Расчёт строительства
    const construction = calculateConstruction(volume, employees, housingPct, housingType, kinderPlaces, sportsList);
    // Ранжирование
    const top3 = rankTop3(budget, needRail, maxHighway, { archStyle, landscapingList });

    if (!top3.length) {
        alert("Не удалось найти подходящие регионы.");
        return;
    }

    // Карта
    if (map) map.remove();
    map = L.map('map').setView([55.0, 50.0], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    top3.forEach((reg, idx) => {
        L.marker(reg.coords).addTo(map)
            .bindPopup(`<b>${idx+1}. ${reg.name}</b><br>Рейтинг: ${reg.score.toFixed(3)}<br>Газ: ${reg.infra.gas_available ? '✅' : '❌'}<br>Мощность: ${reg.infra.free_power_kva} кВА`);
        if (idx === 0) map.setView(reg.coords, 6);
    });

    // Сравнение ТОП-3
    let comparisonHtml = `<div class="card mt-4"><div class="card-header">🏅 Сравнение ТОП-3 регионов</div><div class="card-body"><div class="row">`;
    top3.forEach((reg, idx) => {
        const totalCost = (construction.constructionCost + reg.totalLandConn).toLocaleString('ru-RU');
        comparisonHtml += `
            <div class="col-md-4">
                <div class="border rounded p-3 h-100">
                    <h5>${idx+1}. ${reg.name}</h5>
                    <p class="small">Рейтинг: ${reg.score.toFixed(3)}<br>Стоимость проекта: ${totalCost} ₽<br>Бюджет OK: ${reg.budgetOk === 1 ? "✅" : "⚠️"}</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="scrollToRegion('${reg.name}')">Подробнее ↓</button>
                </div>
            </div>
        `;
    });
    comparisonHtml += `</div></div></div>`;
    document.getElementById('top3Comparison').innerHTML = comparisonHtml;

    // Детальные отчёты
    let reportsHtml = '';
    top3.forEach(reg => {
        const regionConstruction = calculateConstruction(volume, employees, housingPct, housingType, kinderPlaces, sportsList);
        reportsHtml += generateRegionReport(reg, regionConstruction, { archStyle, landscapingList });
    });
    document.getElementById('detailedReports').innerHTML = reportsHtml;

    // Показать блок
    document.getElementById('resultsBlock').style.display = 'block';
    document.getElementById('resultsBlock').scrollIntoView({ behavior: 'smooth' });

    // Сохранить в историю
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        params: { volume, employees, budget, needRail, maxHighway, archStyle, housingPct, housingType, kinderPlaces, sports: sportsList.join(', '), landscaping: landscapingList.join(', ') },
        top3Names: top3.map(r => r.name),
        top3Scores: top3.map(r => r.score.toFixed(3))
    };
    historyEntries.unshift(historyItem);
    if (historyEntries.length > 20) historyEntries.pop();
    saveHistoryToStorage();
    renderHistoryPanel();
    if (window.renderIndustrialScene) {
    window.renderIndustrialScene({
    regionName: top3[0].name,
    volume,
    employees,
    housingPct: parseInt(document.getElementById("housing_pct").value),
    housingType,
    kinderPlaces: parseInt(document.getElementById("kinder_places").value),
    sportsList: Array.from(document.querySelectorAll(".sports:checked")).map(i => i.value),
    landscapingList: Array.from(document.querySelectorAll(".landscaping:checked")).map(i => i.value),
    archStyle: document.getElementById("arch_style").value
});
} else {
    console.error("renderIndustrialScene не найден");
}
    
}

// ------------------------- ИСТОРИЯ (localStorage) -------------------------
function saveHistoryToStorage() {
    localStorage.setItem('industryHistory', JSON.stringify(historyEntries));
}
function loadHistoryFromStorage() {
    const stored = localStorage.getItem('industryHistory');
    if (stored) historyEntries = JSON.parse(stored);
    else historyEntries = [];
}
function renderHistoryPanel() {
    const container = document.getElementById('historyList');
    if (!container) return;
    if (historyEntries.length === 0) {
        container.innerHTML = '<div class="text-muted text-center p-3">📭 История пуста</div>';
        return;
    }
    container.innerHTML = historyEntries.map(entry => `
        <div class="history-item" onclick="restoreHistoryEntry(${entry.id})">
            <div class="history-item-title">🔍 ${entry.params.volume} тыс. м² | ${entry.params.employees} сотр.</div>
            <div class="history-item-sub">🏆 ${entry.top3Names.join(', ')}<br>🕒 ${entry.timestamp}</div>
        </div>
    `).join('');
}
function restoreHistoryEntry(id) {
    const entry = historyEntries.find(e => e.id === id);
    if (!entry) return;
    document.getElementById('volume').value = entry.params.volume;
    document.getElementById('employees').value = entry.params.employees;
    document.getElementById('budget').value = entry.params.budget;
    document.getElementById('need_rail').value = entry.params.needRail;
    document.getElementById('max_highway').value = entry.params.maxHighway;
    document.getElementById('arch_style').value = entry.params.archStyle;
    document.getElementById('housing_pct').value = entry.params.housingPct;
    document.getElementById('housing_type').value = entry.params.housingType;
    document.getElementById('kinder_places').value = entry.params.kinderPlaces;
    // чекбоксы не восстанавливаются для простоты
    calculateAndRank();
}
function clearHistory() {
    historyEntries = [];
    saveHistoryToStorage();
    renderHistoryPanel();
}
document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);
});
window.scrollToRegion = (name) => {
    const reports = document.getElementById('detailedReports');
    const cards = reports.querySelectorAll('.card');
    for (let card of cards) {
        if (card.innerText.includes(name)) {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        }
    }
};
// Получаем значения формы
const userChoice = {
    volume: document.getElementById("volume").value,
    employees: document.getElementById("employees").value,
    housingPct: document.getElementById("housing_pct").value,
    housingType: document.getElementById("housing_type").value,
    kinderPlaces: document.getElementById("kinder_places").value,
    sportsList: Array.from(document.querySelectorAll(".sports:checked")).map(i => i.value),
    landscapingList: Array.from(document.querySelectorAll(".landscaping:checked")).map(i => i.value)
};

// Вызываем генерацию сцены
renderIndustrialScene(userChoice);
window.calculateAndRank = calculateAndRank;
window.restoreHistoryEntry = restoreHistoryEntry;
window.clearHistory = clearHistory;