// M. Pellegrino Importing Co. demo. Live open/closed + catering request (front end only).
// LEAD_URL stays empty in the demo: nothing leaves the browser. At launch set it to the
// owner's inbound webhook (GHL) and the same payload is POSTed as JSON.
const LEAD_URL = "";

// Hours in Albany time. 0 = Sunday. [open, close] in minutes from midnight.
const HOURS = {0:null,1:[540,1020],2:[540,1020],3:[540,1020],4:[540,1020],5:[540,1020],6:[480,900]};
const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const fmt = m => { const h = Math.floor(m/60), mm = m%60, ap = h>=12?"PM":"AM", h12 = ((h+11)%12)+1; return h12 + (mm?":"+String(mm).padStart(2,"0"):"") + " " + ap; };

function albanyNow(){
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date());
  const get = t => parts.find(p=>p.type===t).value;
  const d = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(get("weekday"));
  return {d, m: (parseInt(get("hour"),10)%24)*60 + parseInt(get("minute"),10)};
}

function paintStatus(){
  const pill = document.getElementById("openPill"), txt = document.getElementById("openText");
  if(!pill) return;
  const {d,m} = albanyNow(), h = HOURS[d];
  document.querySelectorAll("#hoursBody tr").forEach(tr => tr.classList.toggle("today", +tr.dataset.d === d));
  if(h && m >= h[0] && m < h[1]){
    pill.className = "pill open";
    txt.textContent = "Open now · until " + fmt(h[1]);
    return;
  }
  pill.className = "pill closed";
  if(h && m < h[0]){ txt.textContent = "Closed · opens " + fmt(h[0]) + " today"; return; }
  for(let i=1;i<=7;i++){
    const nd = (d+i)%7, nh = HOURS[nd];
    if(nh){ txt.textContent = "Closed · opens " + (i===1?"tomorrow":DAY[nd]) + " " + fmt(nh[0]); return; }
  }
}
paintStatus();
setInterval(paintStatus, 60000);

// Catering form
const form = document.getElementById("cateringForm");
if(form){
  const err = document.getElementById("formErr"), done = document.getElementById("formDone"), dl = document.getElementById("formSummary");
  const dateIn = document.getElementById("f-date");
  const t = new Date(); dateIn.min = new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.textContent = "";
    const fd = new FormData(form);
    const data = {
      date: fd.get("date"), guests: fd.get("guests"), want: fd.getAll("want"),
      name: (fd.get("name")||"").trim(), phone: (fd.get("phone")||"").trim(),
      email: (fd.get("email")||"").trim(), notes: (fd.get("notes")||"").trim(),
      source: "pellegrino-site-catering"
    };
    const missing = [];
    if(!data.date) missing.push(["f-date","event date"]);
    if(!data.guests || +data.guests < 1) missing.push(["f-guests","how many people"]);
    if(!data.name) missing.push(["f-name","your name"]);
    if(data.phone.replace(/\D/g,"").length < 10) missing.push(["f-phone","a phone number we can call back"]);
    form.querySelectorAll("[aria-invalid]").forEach(el=>el.removeAttribute("aria-invalid"));
    if(missing.length){
      missing.forEach(([id])=>document.getElementById(id).setAttribute("aria-invalid","true"));
      err.textContent = "Please add " + missing.map(m=>m[1]).join(", ") + ".";
      document.getElementById(missing[0][0]).focus();
      return;
    }
    if(LEAD_URL){
      try{ await fetch(LEAD_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}); }
      catch(_){ err.textContent = "That didn't send. Please call (518) 459-4472."; return; }
    }
    const nice = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
    const rows = [["Date",nice(data.date)],["People",data.guests],["Wants",data.want.join(", ")||"Not picked"],["Name",data.name],["Phone",data.phone]];
    if(data.email) rows.push(["Email",data.email]);
    if(data.notes) rows.push(["Notes",data.notes]);
    dl.replaceChildren(...rows.flatMap(([k,v])=>{ const dt=document.createElement("dt"), dd=document.createElement("dd"); dt.textContent=k; dd.textContent=v; return [dt,dd]; }));
    done.classList.add("show");
    done.focus();
  });
}

// Menu tabs (v2). Without JS every section shows, stacked.
(function(){
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if(!tabs.length) return;
  document.documentElement.classList.add("js");
  const pick = (t, focus) => {
    tabs.forEach(x => {
      const on = x === t;
      x.setAttribute("aria-selected", on);
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute("aria-controls")).classList.toggle("on", on);
    });
    if(focus) t.focus();
  };
  tabs.forEach((t,i) => {
    t.addEventListener("click", () => pick(t));
    t.addEventListener("keydown", e => {
      const k = {ArrowRight:1, ArrowLeft:-1}[e.key];
      if(k){ e.preventDefault(); pick(tabs[(i+k+tabs.length)%tabs.length], true); }
      if(e.key==="Home"){ e.preventDefault(); pick(tabs[0], true); }
      if(e.key==="End"){ e.preventDefault(); pick(tabs[tabs.length-1], true); }
    });
  });
  pick(tabs[0]);
})();
