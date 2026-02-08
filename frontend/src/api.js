const API = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const auth = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (body) => api('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
};

export const regionales = {
  list: () => api('/regionales'),
  create: (body) => api('/regionales', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/regionales/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => api(`/regionales/${id}`, { method: 'DELETE' }),
};

export const distritos = {
  list: (regionalId) => api(regionalId ? `/distritos?regional_id=${regionalId}` : '/distritos'),
  create: (body) => api('/distritos', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/distritos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => api(`/distritos/${id}`, { method: 'DELETE' }),
};

export const sucursales = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(q ? `/sucursales?${q}` : '/sucursales');
  },
  create: (body) => api('/sucursales', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/sucursales/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => api(`/sucursales/${id}`, { method: 'DELETE' }),
};

export const checklist = {
  plantilla: () => api('/checklist/plantilla'),
};

export const upload = {
  foto: (file) => {
    const form = new FormData();
    form.append('foto', file);
    return fetch(`${API}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.error || r.statusText); });
      return r.json();
    });
  },
};

export const visitas = {
  list: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(q ? `/visitas?${q}` : '/visitas');
  },
  get: (id) => api(`/visitas/${id}`),
  downloadPDF: async (id, filename) => {
    const res = await fetch(`${API}/visitas/${id}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText || 'Error al descargar PDF');
    }
    const blob = await res.blob();
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await blob.text().then(JSON.parse).catch(() => ({}));
      throw new Error(data.error || 'El servidor no devolvió un PDF válido');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || `Visita_${id}.pdf`).replace(/[^\w\-_. ]/g, '_') || 'Visita.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  },
  create: (body) => api('/visitas', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/visitas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => fetch(`${API}/visitas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }).then(r => { if (!r.ok) return r.json().then(d => { throw new Error(d.error || r.statusText); }); }),
  uploadFoto: (visitaId, file) => {
    const form = new FormData();
    form.append('foto', file);
    return fetch(`${API}/visitas/${visitaId}/foto`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(r => r.json());
  },
};

export const reportes = {
  sucursal: (id) => api(`/reportes/sucursal/${id}`),
  distrito: (id) => api(`/reportes/distrito/${id}`),
  regional: (id) => api(`/reportes/regional/${id}`),
  comparar: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(q ? `/reportes/comparar?${q}` : '/reportes/comparar');
  },
  historial: (params) => {
    const q = new URLSearchParams(params).toString();
    return api(q ? `/reportes/historial?${q}` : '/reportes/historial');
  },
};

export const email = {
  enviarVisita: (visitaId, { to, incluirPDF }) =>
    api(`/email/enviar-visita/${visitaId}`, {
      method: 'POST',
      body: JSON.stringify({ to, incluirPDF: !!incluirPDF }),
    }),
};
