const API = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchLatest() {
  const res = await fetch(`${API}/api/latest`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchHistory(hours = 24) {
  const res = await fetch(`${API}/api/history?hours=${hours}`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTechnical() {
  const res = await fetch(`${API}/api/technical`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}
