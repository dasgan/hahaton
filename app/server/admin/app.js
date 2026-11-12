const photo = [
  './photos/1.jpg',
  './photos/2.jpg',
  './photos/3.jpg',
  './photos/2.jpg',
  './photos/4.jpg',
  './photos/5.jpg',
  './photos/6.jpg',
  './photos/5.jpg',
];
const samples = [
  { id:'PP-2418', client:'Мария Соколова', title:'Постер 30×40', material:'Матовая · 200 г', due:'11:20', status:'accepted', risk:true, dpi:181, prints:1, type:'poster', img:photo[0], messages:[{from:'customer',text:'Можно успеть к вечеру? Это подарок.',at:'09:41'}] },
  { id:'PP-2417', client:'Антон Л.', title:'Фотокнига Classic', material:'Шёлковая · 170 г', due:'12:30', status:'accepted', risk:false, dpi:320, prints:1, type:'book', img:photo[1], messages:[] },
  { id:'PP-2416', client:'Полина М.', title:'Фото 10×15 · 2 шт.', material:'Матовая · 10×15', due:'13:10', status:'accepted', risk:false, dpi:300, prints:2, type:'print', img:photo[2], messages:[] },
  { id:'PP-2415', client:'Даниил Р.', title:'Фото 10×15 · 2 шт.', material:'Матовая · 10×15', due:'13:15', status:'accepted', risk:false, dpi:300, prints:2, type:'print', img:photo[3], messages:[] },
  { id:'PP-2414', client:'Елена Н.', title:'Фото 10×15 · 2 шт.', material:'Матовая · 10×15', due:'13:20', status:'accepted', risk:false, dpi:300, prints:2, type:'print', img:photo[4], messages:[] },
  { id:'PP-2413', client:'Игорь К.', title:'Фото 10×15 · 2 шт.', material:'Матовая · 10×15', due:'13:25', status:'accepted', risk:false, dpi:300, prints:2, type:'print', img:photo[5], messages:[] },
  { id:'PP-2412', client:'Ольга П.', title:'Открытка с фото', material:'Глянцевая · 300 г', due:'14:40', status:'printing', risk:false, dpi:300, prints:1, type:'postcard', img:photo[6], messages:[] },
  { id:'PP-2411', client:'Михаил В.', title:'Постер 50×70', material:'Матовая · 200 г', due:'15:30', status:'accepted', risk:true, dpi:167, prints:1, type:'poster', img:photo[7], messages:[] },
];
const demoIncoming = { id:'PP-2419', client:'Ксения Г.', title:'Постер 50×70', material:'Матовая · 200 г', due:'10:50', status:'accepted', risk:true, dpi:174, prints:1, type:'poster', img:photo[6], messages:[{from:'customer',text:'Очень важно сохранить качество портрета.',at:'10:06'}] };
const batchIds = ['PP-2416','PP-2415','PP-2414','PP-2413'];
const statusNames = { accepted:'Новый', printing:'В печати', ready:'Готов', shipping:'В доставке', delivered:'Доставлен' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const readState = () => { try { return JSON.parse(localStorage.getItem('picpac-pitch-demo') || '{}'); } catch { return {}; } };
const saved = readState();
const state = { orders: structuredClone(samples), live: [], showLive:false, selected:'PP-2418', filter:'all', search:'', incoming:!!saved.incoming, batchBuilt:!!saved.batchBuilt };
if (state.incoming) state.orders.unshift(structuredClone(demoIncoming));
for (const order of state.orders) {
  const previous = saved.orders?.[order.id];
  if (previous) { order.status = previous.status || order.status; order.messages = previous.messages || order.messages; order.risk = previous.risk ?? order.risk; order.dpi = previous.dpi ?? order.dpi; }
}
const $ = selector => document.querySelector(selector);
const persist = () => localStorage.setItem('picpac-pitch-demo', JSON.stringify({incoming:state.incoming,batchBuilt:state.batchBuilt,orders:Object.fromEntries(state.orders.map(o=>[o.id,{status:o.status,messages:o.messages,risk:o.risk,dpi:o.dpi}]))}));
const allOrders = () => state.showLive ? [...state.live,...state.orders] : state.orders;
const selected = () => allOrders().find(order => order.id === state.selected) || allOrders()[0];
let toastTimer;
function toast(message) { const element=$('#toast'); element.textContent=message; element.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>element.classList.remove('show'),2800); }
function markActive() { document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.hash === location.hash || (!location.hash && link.hash === '#overview'))); }
function renderMetrics() {
  const orders=allOrders();
  $('#metric-queue').textContent=orders.filter(o=>['accepted','printing'].includes(o.status)).length;
  $('#metric-risk').textContent=orders.filter(o=>o.risk && o.status==='accepted').length;
  $('#metric-batch').textContent=state.batchBuilt?0:batchIds.length;
  $('#metric-saving').textContent='2';
  $('#metric-saving-caption').textContent=state.batchBuilt?'сэкономлено в демопартии':'потенциал демопартии';
  $('#nav-count').textContent=orders.length;
  $('#queue-count').textContent=`${orders.length} заказов`;
  $('#batch-orders').textContent=batchIds.length;
  $('#batch-before').textContent='4'; $('#batch-after').textContent='2';
}
function renderPriorities() {
  const risk=allOrders().find(o=>o.risk && o.status==='accepted');
  const cards=[];
  if (risk) cards.push(`<button class="priority" data-select="${escapeHtml(risk.id)}"><span class="icon">◉</span><span><strong>Проверить качество: ${escapeHtml(risk.title)}</strong><small>${escapeHtml(risk.client)} · ${risk.dpi} dpi при печати</small></span><span class="arrow">→</span></button>`);
  if (!state.batchBuilt) cards.push('<button class="priority green" data-scroll="batch"><span class="icon">▦</span><span><strong>Собрать 4 заказа на одном материале</strong><small>2 листа вместо 4 — оценка для демо</small></span><span class="arrow">→</span></button>');
  if (!cards.length) cards.push('<div class="priority green"><span class="icon">✓</span><span><strong>Срочных действий нет</strong><small>Очередь под контролем</small></span></div>');
  $('#priority-list').innerHTML=cards.join('');
}
function orderStatus(order) {
  if (order.risk && order.status==='accepted') return '<span class="tag risk">Проверить фото</span>';
  if (order.status==='accepted') return '<span class="tag ready">К печати</span>';
  return `<span class="tag progress">${escapeHtml(statusNames[order.status] || order.status)}</span>`;
}
function renderQueue() {
  const query=state.search.toLowerCase();
  const filtered=allOrders().filter(o=>{
    if (state.filter==='risk' && !(o.risk && o.status==='accepted')) return false;
    if (state.filter==='ready' && (o.risk || o.status!=='accepted')) return false;
    return `${o.title} ${o.client} ${o.id}`.toLowerCase().includes(query);
  });
  $('#order-rows').innerHTML=filtered.length?filtered.map(o=>`<tr class="order-row ${o.id===state.selected?'selected':''}" data-select="${escapeHtml(o.id)}"><td><div class="order-title"><img src="${escapeHtml(o.img)}" alt=""><span><strong>${escapeHtml(o.title)}</strong><small>${escapeHtml(o.client)} · ${escapeHtml(o.id)}</small></span></div></td><td>${escapeHtml(o.material)}</td><td class="${o.due<'12:00'?'due-urgent':''}">${escapeHtml(o.due)}</td><td>${orderStatus(o)}</td><td>→</td></tr>`).join(''):'<tr><td colspan="5">По этому фильтру заказов нет</td></tr>';
}
function renderDetail() {
  const order=selected(); if (!order) return;
  $('#detail-id').textContent=order.id;
  const quality=order.risk
    ? `<div class="quality-card"><strong>◉ Проверьте снимок до печати</strong><p>При размере ${escapeHtml(order.title)} качество составит около ${order.dpi} dpi. Лучше запросить исходник, прежде чем запускать заказ.</p></div>`
    : `<div class="quality-card ok"><strong>✓ Фото готово к печати</strong><p>Разрешение подходит для выбранного формата. Можно продолжать без дополнительного согласования.</p></div>`;
  $('#detail-body').innerHTML=`<img class="detail-photo" src="${escapeHtml(order.img)}" alt="Фото заказа"><h3 class="detail-title">${escapeHtml(order.title)}</h3><div class="detail-meta">${escapeHtml(order.client)} · срок ${escapeHtml(order.due)}</div><div class="detail-line"><span>Материал</span><strong>${escapeHtml(order.material)}</strong></div><div class="detail-line"><span>Кол-во</span><strong>${order.prints} ${order.prints===1?'экземпляр':'отпечатка'}</strong></div><div class="detail-line"><span>Статус</span><strong>${escapeHtml(statusNames[order.status] || order.status)}</strong></div>${quality}<div class="detail-actions"><button class="outline-button" data-action="ask">${order.risk?'Запросить исходник':'Написать клиенту'}</button>${order.risk && !order.live ? '<button class="outline-button" data-action="approve">Исходник получен ✓</button>' : ''}<button class="primary-button small" data-action="advance">${order.status==='accepted'?'В печать →':'Следующий этап →'}</button></div>`;
}
function renderMessages() {
  const order=selected();
  const messages=order?.messages || [];
  $('#messages').innerHTML=messages.length?messages.map(m=>`<div class="bubble ${m.from==='admin'?'admin':''}">${escapeHtml(m.text)}<small>${m.from==='admin'?'Оператор':'Клиент'} · ${escapeHtml(m.at||'сейчас')}</small></div>`).join(''):'<div class="bubble">Пока нет сообщений. Диалог появится здесь, когда клиент или оператор напишет по заказу.</div>';
}
function renderSheet() {
  $('#sheet-preview').innerHTML=batchIds.map((id,i)=>`<div class="sheet-slot" style="background-image:url('${escapeHtml(state.orders.find(o=>o.id===id)?.img || photo[i])}')"></div>`).join('');
  $('#build-batch').textContent=state.batchBuilt?'Партия сформирована ✓':'Сформировать партию →';
  $('#build-batch').disabled=state.batchBuilt;
}
function render() { renderMetrics(); renderPriorities(); renderQueue(); renderDetail(); renderMessages(); renderSheet(); markActive(); }
async function loadLive() {
  try {
    const response=await fetch('/api/admin/orders'); if (!response.ok) return;
    const rows=await response.json();
    state.live=rows.map(o=>({id:o.id,client:o.scenario||'Клиент PicPac',title:o.title,material:o.config?.paper==='glossy'?'Глянцевая':'Матовая',due:'Поступил',status:o.status,risk:false,dpi:300,prints:o.config?.copies||1,img:`/api/admin/orders/${encodeURIComponent(o.id)}/photos/0`,messages:o.messages||[],live:true}));
    const button=$('#toggle-live');
    if (state.live.length) { button.hidden=false; button.textContent=`Заказы из приложения · ${state.live.length}`; }
    render();
  } catch { /* The standalone pitch demo works without the API. */ }
}
async function sendMessage() {
  const order=selected(); const input=$('#message-input'); const text=input.value.trim();
  if (!text || !order) return;
  if (order.live) {
    try { const response=await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});if (!response.ok) throw Error('Не удалось отправить');const updated=await response.json();order.messages=updated.messages; }
    catch { toast('Сообщение не отправлено. Проверьте сервер.'); return; }
  } else { order.messages.push({from:'admin',text,at:new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})});persist(); }
  input.value='';renderMessages();toast('Ответ добавлен в диалог');
}
async function advance() {
  const order=selected(); if (!order) return;
  if (order.risk && order.status==='accepted') { toast('Сначала согласуйте качество снимка с клиентом');return; }
  const stages=['accepted','printing','ready','shipping','delivered'];
  const next=stages[Math.min(stages.indexOf(order.status)+1,stages.length-1)];
  if (order.live) {
    try {const response=await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});if(!response.ok)throw Error();}
    catch {toast('Не удалось обновить статус');return;}
  }
  order.status=next;persist();render();toast(`Статус: ${statusNames[next]}`);
}
function createBatch() {
  if (state.batchBuilt) return;
  state.batchBuilt=true;
  for (const order of state.orders) if (batchIds.includes(order.id)) order.status='printing';
  persist();render();toast('Партия готова: 8 фото на 2 листах вместо 4');
}
document.addEventListener('click',event=>{
  const row=event.target.closest('[data-select]'); if(row){state.selected=row.dataset.select;render();document.querySelector('#detail').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
  const scroll=event.target.closest('[data-scroll]');if(scroll){document.getElementById(scroll.dataset.scroll).scrollIntoView({behavior:'smooth'});return;}
  const action=event.target.closest('[data-action]');if(action?.dataset.action==='ask'){const o=selected();$('#message-input').value=o?.risk?`Здравствуйте! Для печати ${o.title} лучше прислать фото в исходном качестве. Можете отправить оригинальный файл без сжатия?`:'Здравствуйте! Пишем вам по заказу PicPac.';$('#message-input').focus();$('#dialog').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
  if(action?.dataset.action==='advance') advance();
  if(action?.dataset.action==='approve'){const o=selected();if(o && !o.live){o.risk=false;o.dpi=300;persist();render();toast('Исходник получен: заказ готов к печати');}}
});
$('#new-order').addEventListener('click',()=>{if (!state.incoming){state.orders.unshift(structuredClone(demoIncoming));state.incoming=true;}state.selected=demoIncoming.id;persist();render();toast('Новый заказ появился в очереди');document.querySelector('#detail').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('#build-batch').addEventListener('click',createBatch);
$('#reset-demo').addEventListener('click',()=>{localStorage.removeItem('picpac-pitch-demo');location.reload();});
$('#toggle-live').addEventListener('click',()=>{state.showLive=!state.showLive;state.selected=state.showLive?state.live[0]?.id||'PP-2418':'PP-2418';$('#toggle-live').classList.toggle('active',state.showLive);render();});
$('#send-message').addEventListener('click',sendMessage);
$('#suggest-reply').addEventListener('click',()=>{const o=selected();$('#message-input').value=o?.risk?`Здравствуйте! Чтобы ${o.title} выглядел чётко, пришлите, пожалуйста, исходный файл без сжатия. После получения сразу продолжим заказ.`:`Здравствуйте! Ваш заказ «${o?.title||'PicPac'}» у нас в работе. Напишем, когда он будет готов.`;$('#message-input').focus();});
$('#search').addEventListener('input',event=>{state.search=event.target.value;renderQueue();});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));renderQueue();}));
window.addEventListener('hashchange',markActive);
render();loadLive();
