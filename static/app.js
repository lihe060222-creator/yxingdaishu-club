/**
 * Y性代数·不止Y数 (Y-Linear Algebra Society)
 * Client Application Logic: Auth (Email Only), Admin Member Management, Matrix Visualizer
 */

// Application State
const state = {
  token: localStorage.getItem('y_auth_token') || null,
  user: null,
  members: [],
  seminars: [],
  authMode: 'login' // 'login' or 'register'
};

// ============================================================================
// Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initHeroCanvas();
  initLabCanvas();
  fetchStats();
  fetchSeminars();
  checkAuth();
});

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  
  let icon = 'fa-info-circle text-indigo-400';
  if (type === 'success') icon = 'fa-check-circle text-emerald-400';
  if (type === 'error') icon = 'fa-circle-exclamation text-rose-400';

  toast.innerHTML = `
    <i class="fa-solid ${icon} mr-2.5 text-base"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// Authentication & User State (Strictly Email Based)
// ============================================================================
async function checkAuth() {
  if (!state.token) {
    updateAuthUI(null);
    return;
  }

  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      updateAuthUI(state.user);
      if (state.user.role === 'admin') {
        fetchAdminMembers();
      }
    } else {
      localStorage.removeItem('y_auth_token');
      state.token = null;
      state.user = null;
      updateAuthUI(null);
    }
  } catch (err) {
    console.error('Check auth failed:', err);
    updateAuthUI(null);
  }
}

function updateAuthUI(user) {
  const loggedOut = document.getElementById('auth-logged-out');
  const loggedIn = document.getElementById('auth-logged-in');
  const navAdminLink = document.getElementById('nav-admin-link');
  const mobileAdminLink = document.getElementById('mobile-admin-link');
  const adminGatekeeper = document.getElementById('admin-gatekeeper');
  const adminContent = document.getElementById('admin-content');

  if (user) {
    loggedOut.classList.add('hidden');
    loggedIn.classList.remove('hidden');

    document.getElementById('user-display-name').textContent = user.name || user.email.split('@')[0];
    const roleText = document.getElementById('user-role-text');
    if (user.role === 'admin') {
      roleText.textContent = '信息库管理员';
      roleText.className = 'text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold';
      navAdminLink.classList.remove('hidden');
      mobileAdminLink.classList.remove('hidden');
      adminGatekeeper.classList.add('hidden');
      adminContent.classList.remove('hidden');
    } else {
      roleText.textContent = '研讨成员';
      roleText.className = 'text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
      navAdminLink.classList.add('hidden');
      mobileAdminLink.classList.add('hidden');
      adminGatekeeper.classList.remove('hidden');
      adminContent.classList.add('hidden');
    }
  } else {
    loggedOut.classList.remove('hidden');
    loggedIn.classList.add('hidden');
    navAdminLink.classList.add('hidden');
    mobileAdminLink.classList.add('hidden');
    adminGatekeeper.classList.remove('hidden');
    adminContent.classList.add('hidden');
  }
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  switchAuthTab(mode);
  document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function switchAuthTab(mode) {
  state.authMode = mode;
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const registerFields = document.getElementById('register-fields');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (mode === 'login') {
    tabLogin.className = 'flex-1 pb-3 text-center border-b-2 border-indigo-500 text-white font-semibold';
    tabRegister.className = 'flex-1 pb-3 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200';
    registerFields.classList.add('hidden');
    submitBtn.textContent = '立即邮箱登录';
  } else {
    tabRegister.className = 'flex-1 pb-3 text-center border-b-2 border-indigo-500 text-white font-semibold';
    tabLogin.className = 'flex-1 pb-3 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200';
    registerFields.classList.remove('hidden');
    submitBtn.textContent = '注册并加入社团 (邮箱认证)';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name') ? document.getElementById('auth-name').value.trim() : '';
  const interest = document.getElementById('auth-interest') ? document.getElementById('auth-interest').value.trim() : '';

  const endpoint = state.authMode === 'register' ? '/api/register' : '/api/login';
  const payload = { email, password };
  if (state.authMode === 'register') {
    payload.name = name;
    payload.academic_interest = interest;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || '操作失败，请核对输入', 'error');
      return;
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('y_auth_token', data.token);
    updateAuthUI(state.user);
    closeAuthModal();

    showToast(data.message || '欢迎回来！', 'success');

    if (state.user.role === 'admin') {
      fetchAdminMembers();
    }
    fetchStats();
  } catch (err) {
    showToast('网络请求错误，请稍后重试', 'error');
  }
}

function fillAdminDemo() {
  document.getElementById('auth-email').value = 'admin@yxingdaishu.org';
  document.getElementById('auth-password').value = 'lh660680';
  openAuthModal('login');
  showToast('已填入管理员凭证：admin@yxingdaishu.org，点击登录即可！', 'info');
}

async function handleLogout() {
  try {
    if (state.token) {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
    }
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('y_auth_token');
  state.token = null;
  state.user = null;
  updateAuthUI(null);
  showToast('已安全退出账号', 'info');
}

// ============================================================================
// Administrator Member Management (添加/移除/权限/导出)
// ============================================================================
async function fetchAdminMembers() {
  if (!state.token || !state.user || state.user.role !== 'admin') return;

  try {
    const res = await fetch('/api/admin/members', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      state.members = data.members;
      renderMembersTable(state.members);
    }
  } catch (err) {
    showToast('获取信息库成员列表失败', 'error');
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById('members-table-body');
  const countFooter = document.getElementById('members-count-footer');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-slate-500">
          未检索到符合条件的成员记录
        </td>
      </tr>
    `;
    countFooter.textContent = '共 0 条成员记录';
    return;
  }

  tbody.innerHTML = members.map(m => {
    const isAdmin = m.role === 'admin';
    const isCurrent = state.user && state.user.id === m.id;
    const isActive = m.status === 'active';

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-indigo-400'} flex items-center justify-center font-bold text-xs font-mono">
              ${m.name.charAt(0)}
            </div>
            <div>
              <div class="font-semibold text-slate-200 flex items-center space-x-1.5">
                <span>${escapeHtml(m.name)}</span>
                ${isCurrent ? '<span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono">您当前</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-500">ID: #${m.id} · ${escapeHtml(m.affiliation || '学术成员')}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 font-mono text-xs text-indigo-300">
          ${escapeHtml(m.email)}
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${isAdmin ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'}">
            <i class="fa-solid ${isAdmin ? 'fa-shield-halved text-amber-400 mr-1.5' : 'fa-user text-slate-400 mr-1.5'} text-[10px]"></i>
            ${isAdmin ? '信息库主管 (Admin)' : '研讨成员 (Member)'}
          </span>
        </td>
        <td class="px-6 py-4 text-xs text-slate-300 max-w-xs truncate" title="${escapeHtml(m.academic_interest || '')}">
          ${escapeHtml(m.academic_interest || '常规学术研讨')}
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center space-x-1.5 text-xs ${isActive ? 'text-emerald-400' : 'text-slate-500'}">
            <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
            <span>${isActive ? '正常' : '已停用'}</span>
          </span>
        </td>
        <td class="px-6 py-4 font-mono text-xs text-slate-400">
          ${escapeHtml(m.created_at || '-')}
        </td>
        <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
          ${!isCurrent ? `
            <button onclick="toggleMemberRole(${m.id}, '${isAdmin ? 'member' : 'admin'}')" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" title="调整管理员角色">
              ${isAdmin ? '降为成员' : '设为管理员'}
            </button>
            <button onclick="toggleMemberStatus(${m.id}, '${isActive ? 'inactive' : 'active'}')" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" title="切换启用/停用">
              ${isActive ? '停用' : '启用'}
            </button>
            <button onclick="removeMember(${m.id}, '${escapeHtml(m.name)}')" class="text-xs px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30" title="从信息库中移除">
              <i class="fa-solid fa-trash-can mr-1"></i>移除
            </button>
          ` : `
            <span class="text-xs text-slate-500 italic">当前登录中</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  countFooter.innerHTML = `
    <span>展示 <strong>${members.length}</strong> / 共 <strong>${state.members.length}</strong> 位成员</span>
    <span class="font-mono text-slate-500">更新于: ${new Date().toLocaleTimeString()}</span>
  `;
}

function filterMembersTable() {
  const query = (document.getElementById('member-search-input').value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('member-filter-role').value;

  const filtered = state.members.filter(m => {
    const matchQuery = !query || 
      m.email.toLowerCase().includes(query) || 
      m.name.toLowerCase().includes(query) || 
      (m.academic_interest && m.academic_interest.toLowerCase().includes(query));

    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchQuery && matchRole;
  });

  renderMembersTable(filtered);
}

// Admin Operations
function openAddMemberModal() {
  document.getElementById('add-member-modal').classList.remove('hidden');
}

function closeAddMemberModal() {
  document.getElementById('add-member-modal').classList.add('hidden');
}

async function handleAdminAddMember(e) {
  e.preventDefault();
  const email = document.getElementById('new-member-email').value.trim();
  const name = document.getElementById('new-member-name').value.trim();
  const role = document.getElementById('new-member-role').value;
  const interest = document.getElementById('new-member-interest').value.trim();
  const password = document.getElementById('new-member-pwd').value;

  try {
    const res = await fetch('/api/admin/members/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ email, name, role, academic_interest: interest, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '添加失败', 'error');
      return;
    }

    showToast(data.message || '成员已录入信息库！', 'success');
    closeAddMemberModal();
    fetchAdminMembers();
    fetchStats();
  } catch (err) {
    showToast('网络请求异常', 'error');
  }
}

async function removeMember(id, name) {
  if (!confirm(`确定要从社团信息库中移除成员「${name}」吗？\n该操作将删除该邮箱账号的所有登录及研讨关联数据。`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/members/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '移除失败', 'error');
      return;
    }

    showToast(data.message || '已成功移除成员', 'success');
    fetchAdminMembers();
    fetchStats();
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

async function toggleMemberRole(id, newRole) {
  try {
    const res = await fetch('/api/admin/members/toggle-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id, role: newRole })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '权限更新失败', 'error');
      return;
    }

    showToast(data.message, 'success');
    fetchAdminMembers();
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

async function toggleMemberStatus(id, newStatus) {
  try {
    const res = await fetch('/api/admin/members/toggle-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ id, status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '状态更新失败', 'error');
      return;
    }

    showToast(data.message, 'success');
    fetchAdminMembers();
  } catch (err) {
    showToast('网络错误', 'error');
  }
}

function exportMembersCSV() {
  if (!state.members || state.members.length === 0) {
    showToast('暂无成员数据可导出', 'info');
    return;
  }

  let csv = '\uFEFFID,认证邮箱,成员姓名,身份角色,研讨方向,所属机构,账号状态,录入时间\n';
  state.members.forEach(m => {
    csv += `"${m.id}","${m.email}","${m.name}","${m.role}","${m.academic_interest || ''}","${m.affiliation || ''}","${m.status}","${m.created_at}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Y性代数_社团成员信息库_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('已生成并下载社团成员信息库 CSV 文件！', 'success');
}

// ============================================================================
// Seminars & Stats Fetching
// ============================================================================
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      const elTotal = document.getElementById('stat-total-users');
      const elSeminars = document.getElementById('stat-seminars');
      if (elTotal) elTotal.textContent = `${data.total_users}+`;
      if (elSeminars) elSeminars.textContent = `${data.total_seminars * 14}+`;
    }
  } catch (e) {
    // ignore
  }
}

async function fetchSeminars() {
  try {
    const res = await fetch('/api/seminars');
    if (res.ok) {
      const data = await res.json();
      state.seminars = data.seminars;
      renderSeminars(state.seminars);
    }
  } catch (e) {
    // ignore
  }
}

function renderSeminars(seminars) {
  const container = document.getElementById('seminars-container');
  if (!container) return;

  if (seminars.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-slate-500">近期学术日程整理中...</div>';
    return;
  }

  container.innerHTML = seminars.map(s => {
    const tagList = s.tags.split(',').map(t => `<span class="bg-indigo-950/70 border border-indigo-800/40 text-indigo-300 text-[11px] px-2 py-0.5 rounded">${escapeHtml(t.trim())}</span>`).join(' ');

    return `
      <div class="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div class="space-y-2 max-w-3xl">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <i class="fa-regular fa-clock mr-1"></i>${escapeHtml(s.date)}
            </span>
            <span class="text-xs text-slate-400">
              <i class="fa-solid fa-location-dot mr-1 text-slate-500"></i>${escapeHtml(s.location)}
            </span>
          </div>

          <h3 class="text-lg font-bold text-white">${escapeHtml(s.title)}</h3>
          <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(s.description)}</p>

          <div class="flex items-center space-x-3 pt-2">
            <span class="text-xs text-indigo-400 font-semibold">主讲领读: ${escapeHtml(s.speaker)}</span>
            <div class="flex items-center space-x-1.5">${tagList}</div>
          </div>
        </div>

        <div class="flex-shrink-0">
          <button onclick="rsvpSeminar('${escapeHtml(s.title)}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all flex items-center space-x-2">
            <i class="fa-solid fa-calendar-check"></i>
            <span>预约研讨席位</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function rsvpSeminar(title) {
  if (!state.user) {
    showToast('预约研讨席位需先完成社团邮箱登录', 'info');
    openAuthModal('login');
    return;
  }
  showToast(`已成功为您的邮箱 (${state.user.email}) 预约【${title}】的研讨席位！白皮书将发送至邮箱。`, 'success');
}

// ============================================================================
// Interactive Vector & Matrix Canvas
// ============================================================================
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const slider = document.getElementById('hero-theta-slider');
  const matDisplay = document.getElementById('hero-matrix-display');
  const detDisplay = document.getElementById('hero-det-display');

  function render() {
    const angle = (parseFloat(slider.value) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const a = 1.1 * cos;
    const b = -0.7 * sin;
    const c = 0.8 * sin;
    const d = 1.0 * cos;
    const det = (a * d - b * c);

    if (matDisplay) matDisplay.textContent = `[[${a.toFixed(2)}, ${b.toFixed(2)}], [${c.toFixed(2)}, ${d.toFixed(2)}]]`;
    if (detDisplay) detDisplay.textContent = `${det.toFixed(2)} (${det >= 0 ? '保持手征性' : '镜像反转'})`;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 55;

    ctx.clearRect(0, 0, w, h);

    // Background Grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Original Unit Square / Circle
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();

    // Transformed Ellipse
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2; t += 0.05) {
      const ux = Math.cos(t);
      const uy = Math.sin(t);
      const tx = a * ux + b * uy;
      const ty = c * ux + d * uy;
      const px = cx + tx * scale;
      const py = cy - ty * scale;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Basis vector i -> [a, c]
    drawVector(ctx, cx, cy, cx + a * scale, cy - c * scale, '#f43f5e', 'A·î');
    // Basis vector j -> [b, d]
    drawVector(ctx, cx, cy, cx + b * scale, cy - d * scale, '#10b981', 'A·ĵ');
  }

  slider.addEventListener('input', render);
  render();
}

function initLabCanvas() {
  const canvas = document.getElementById('lab-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const pA = document.getElementById('param-a');
  const pB = document.getElementById('param-b');
  const pC = document.getElementById('param-c');
  const pD = document.getElementById('param-d');

  function renderLab() {
    const a = parseFloat(pA.value);
    const b = parseFloat(pB.value);
    const c = parseFloat(pC.value);
    const d = parseFloat(pD.value);

    document.getElementById('val-a').textContent = a.toFixed(1);
    document.getElementById('val-b').textContent = b.toFixed(1);
    document.getElementById('val-c').textContent = c.toFixed(1);
    document.getElementById('val-d').textContent = d.toFixed(1);

    const det = a * d - b * c;
    const tr = a + d;
    document.getElementById('lab-det').textContent = det.toFixed(2);
    document.getElementById('lab-trace').textContent = tr.toFixed(2);

    // Eigenvalues quadratic: λ^2 - tr*λ + det = 0
    const disc = tr * tr - 4 * det;
    if (disc >= 0) {
      const l1 = (tr + Math.sqrt(disc)) / 2;
      const l2 = (tr - Math.sqrt(disc)) / 2;
      document.getElementById('lab-eigen').textContent = `${l1.toFixed(2)}, ${l2.toFixed(2)} (实特征值)`;
    } else {
      const real = (tr / 2).toFixed(2);
      const imag = (Math.sqrt(-disc) / 2).toFixed(2);
      document.getElementById('lab-eigen').textContent = `${real} ± ${imag}i (复特征值, 伴随旋转)`;
    }

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 70;

    ctx.clearRect(0, 0, w, h);

    // Transformed Grid Lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    for (let u = -4; u <= 4; u++) {
      // line where x = u, y goes -4 to 4
      const x1 = cx + (a * u + b * -4) * scale;
      const y1 = cy - (c * u + d * -4) * scale;
      const x2 = cx + (a * u + b * 4) * scale;
      const y2 = cy - (c * u + d * 4) * scale;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // line where y = u, x goes -4 to 4
      const x3 = cx + (a * -4 + b * u) * scale;
      const y3 = cy - (c * -4 + d * u) * scale;
      const x4 = cx + (a * 4 + b * u) * scale;
      const y4 = cy - (c * 4 + d * u) * scale;
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // Origin
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Basis vectors
    drawVector(ctx, cx, cy, cx + a * scale, cy - c * scale, '#f43f5e', `A·î (${a.toFixed(1)}, ${c.toFixed(1)})`);
    drawVector(ctx, cx, cy, cx + b * scale, cy - d * scale, '#10b981', `A·ĵ (${b.toFixed(1)}, ${d.toFixed(1)})`);
  }

  [pA, pB, pC, pD].forEach(input => input.addEventListener('input', renderLab));
  renderLab();
}

function resetLabMatrix() {
  document.getElementById('param-a').value = 1.0;
  document.getElementById('param-b').value = 0.0;
  document.getElementById('param-c').value = 0.0;
  document.getElementById('param-d').value = 1.0;
  const event = new Event('input');
  document.getElementById('param-a').dispatchEvent(event);
  showToast('实验台矩阵已重置为标准单位阵 I', 'info');
}

function drawVector(ctx, fromX, fromY, toX, toY, color, label) {
  const headlen = 10;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillStyle = color;
    ctx.fillText(label, toX + 8, toY - 4);
  }
}

// Canva Templates Preview Modal
function openCanvaModal(type) {
  let title = 'Canva 学术海报排版';
  let desc = '支持快速导入至 Canva 官方网页端编辑：社团已配置深色学术风 (Dark Academic Slate) 配色板与 LaTeX 矢量公式插槽。';
  if (type === 'cert') {
    title = 'Canva 特征学术铭牌与研讨荣誉证书';
    desc = '社团通过 Canva 模板为参与论文报告的社员颁发数字学术铭牌，内嵌哈希学术编号与防伪矩阵印记。';
  } else if (type === 'slides') {
    title = 'Canva 16:9 黑曜石学术演讲幻灯片母版';
    desc = '内置论文速览结构（Motivation, Theoretical Model, Empirical Analysis, Conclusion），支持一键协同演讲。';
  }

  alert(`【${title}】\n\n${desc}\n\n建议使用 Antigravity 中的 Canva 官方插件直接在 IDE 内进行设计调整与同步！`);
}

function toggleMobileMenu() {
  const nav = document.getElementById('mobile-nav');
  nav.classList.toggle('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
