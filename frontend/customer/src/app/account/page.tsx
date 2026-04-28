"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Address, AddressInput, addresses as addrApi, auth as authApi, Profile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AccountPage() {
  const { token, isReady } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [p, a] = await Promise.all([authApi.me(token), addrApi.list(token)]);
      setProfile(p);
      setAddresses(a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [token]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) { router.push("/login?next=/account"); return; }
    load();
  }, [isReady, token, router, load]);

  if (!isReady || !token) return null;
  if (error) return <p className="text-red-700">{error}</p>;
  if (!profile) return <p className="text-black/60">Loading…</p>;

  return (
    <div className="space-y-10">
      <ProfileSection profile={profile} token={token} onUpdated={load} />

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold">Addresses</h2>
          <button
            onClick={() => setEditing("new")}
            className="text-sm text-accent hover:underline"
          >
            + Add address
          </button>
        </div>

        {editing && (
          <AddressForm
            token={token}
            initial={editing === "new" ? undefined : editing}
            onDone={() => { setEditing(null); load(); }}
            onCancel={() => setEditing(null)}
          />
        )}

        <div className="space-y-3 mt-4">
          {addresses.map((a) => (
            <div key={a.id} className="bg-white border border-black/10 rounded p-4 flex justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.label}</p>
                  {a.is_default && (
                    <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-black/70 mt-1">
                  {a.full_name}<br />
                  {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
                  {a.city}{a.region ? `, ${a.region}` : ""} {a.postal_code}<br />
                  {a.country}
                </p>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <button
                  onClick={() => setEditing(a)}
                  className="text-accent hover:underline"
                >Edit</button>
                <button
                  onClick={async () => { await addrApi.remove(token, a.id); load(); }}
                  className="text-red-700 hover:underline"
                >Delete</button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-black/50 text-sm">No saved addresses yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileSection({
  profile, token, onUpdated,
}: { profile: Profile; token: string; onUpdated: () => void }) {
  const [name, setName] = useState(profile.full_name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    try {
      await authApi.updateMe(token, name);
      setSaved(true);
      onUpdated();
    } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">Profile</h2>
      <div className="bg-white border border-black/10 rounded p-4 space-y-3">
        <div>
          <p className="text-sm text-black/60">Email</p>
          <p>{profile.email}</p>
        </div>
        <div>
          <label className="text-sm text-black/60">Full name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-black/15 rounded"
          />
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
        >
          {busy ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}

function AddressForm({
  token, initial, onDone, onCancel,
}: {
  token: string;
  initial?: Address;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<AddressInput>(
    initial ? {
      label: initial.label, full_name: initial.full_name,
      line1: initial.line1, line2: initial.line2,
      city: initial.city, region: initial.region,
      postal_code: initial.postal_code, country: initial.country,
      is_default: initial.is_default,
    } : {
      label: "Home", full_name: "", line1: "", line2: "",
      city: "", region: "", postal_code: "", country: "",
      is_default: false,
    },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof AddressInput>(k: K, val: AddressInput[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (initial) await addrApi.update(token, initial.id, v);
      else await addrApi.add(token, v);
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-black/10 rounded p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Label" value={v.label} onChange={(s) => set("label", s)} />
        <Input label="Full name" value={v.full_name} onChange={(s) => set("full_name", s)} required />
      </div>
      <Input label="Address line 1" value={v.line1} onChange={(s) => set("line1", s)} required />
      <Input label="Address line 2" value={v.line2} onChange={(s) => set("line2", s)} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="City" value={v.city} onChange={(s) => set("city", s)} required />
        <Input label="Region" value={v.region} onChange={(s) => set("region", s)} />
        <Input label="Postal code" value={v.postal_code} onChange={(s) => set("postal_code", s)} />
      </div>
      <Input label="Country (2 letters, e.g. LB, US)"
             value={v.country}
             onChange={(s) => set("country", s.toUpperCase().slice(0, 2))}
             required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.is_default}
               onChange={(e) => set("is_default", e.target.checked)} />
        Default shipping address
      </label>
      {err && <p className="text-red-700 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy}
          className="px-4 py-2 bg-accent text-white rounded hover:bg-emerald-800 disabled:bg-black/30"
        >
          {busy ? "Saving…" : "Save address"}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 border border-black/15 rounded hover:border-black/30"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Input({
  label, value, onChange, required = false,
}: {
  label: string; value: string; onChange: (s: string) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-black/15 rounded bg-white"
      />
    </div>
  );
}
