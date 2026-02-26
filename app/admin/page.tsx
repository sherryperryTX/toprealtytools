"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  usage_count: number;
  unlimited: boolean;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  async function checkAdminAndLoadUsers() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Check if user is admin
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .single();

      if (!adminData) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Load all usage data
      const { data: usageData } = await supabase
        .from("usage_tracking")
        .select("user_id, user_email, created_at")
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      // Load all user settings
      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("user_id, unlimited");

      // Build user map from usage data
      const userMap = new Map<string, UserRow>();

      if (usageData) {
        for (const row of usageData) {
          if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, {
              id: row.user_id,
              email: row.user_email || "Unknown",
              created_at: "",
              last_sign_in_at: null,
              usage_count: 0,
              unlimited: false,
            });
          }
          const user = userMap.get(row.user_id)!;
          user.usage_count++;
        }
      }

      // Merge settings
      if (settingsData) {
        for (const setting of settingsData) {
          const user = userMap.get(setting.user_id);
          if (user) {
            user.unlimited = setting.unlimited;
          } else {
            // User has settings but no usage this month
            userMap.set(setting.user_id, {
              id: setting.user_id,
              email: "Unknown",
              created_at: "",
              last_sign_in_at: null,
              usage_count: 0,
              unlimited: setting.unlimited,
            });
          }
        }
      }

      setUsers(Array.from(userMap.values()).sort((a, b) => b.usage_count - a.usage_count));
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleUnlimited(userId: string, currentValue: boolean) {
    setSaving(userId);
    try {
      if (currentValue) {
        // Remove unlimited
        await supabase
          .from("user_settings")
          .update({ unlimited: false, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      } else {
        // Set unlimited — upsert
        await supabase
          .from("user_settings")
          .upsert({
            user_id: userId,
            unlimited: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
      }

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, unlimited: !currentValue } : u)
      );
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-bold text-navy mb-2">Access Denied</h1>
            <p className="text-gray-400 text-sm mb-4">You don&apos;t have admin access.</p>
            <a href="/" className="text-rust font-medium hover:underline text-sm">← Back to Home</a>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        {/* Header */}
        <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/60 hover:text-white text-sm">← Home</a>
            <h1 className="text-lg font-display font-bold">🛡️ Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkAdminAndLoadUsers}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-3xl font-bold text-navy">{users.length}</div>
              <div className="text-sm text-gray-400">Active Users</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-3xl font-bold text-rust">
                {users.reduce((sum, u) => sum + u.usage_count, 0)}
              </div>
              <div className="text-sm text-gray-400">Messages This Month</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-3xl font-bold text-sage">
                {users.filter(u => u.unlimited).length}
              </div>
              <div className="text-sm text-gray-400">Unlimited Users</div>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-navy">User Management</h2>
              <p className="text-xs text-gray-400">Toggle unlimited access for individual users</p>
            </div>

            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No users with usage data yet. Users will appear here once they start using the tools.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 font-medium text-gray-500">Email</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-center">Messages</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-center">Status</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-center">Unlimited</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-700">{user.email}</div>
                        <div className="text-[10px] text-gray-300 font-mono">{user.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`font-bold ${user.usage_count >= 50 ? "text-rust" : user.usage_count >= 40 ? "text-yellow-600" : "text-gray-700"}`}>
                          {user.usage_count}
                        </span>
                        <span className="text-gray-300"> / 50</span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {user.unlimited ? (
                          <span className="inline-block bg-sage/10 text-sage text-xs font-bold px-2 py-0.5 rounded-full">Unlimited</span>
                        ) : user.usage_count >= 50 ? (
                          <span className="inline-block bg-rust/10 text-rust text-xs font-bold px-2 py-0.5 rounded-full">At Limit</span>
                        ) : (
                          <span className="inline-block bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">Free</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => toggleUnlimited(user.id, user.unlimited)}
                          disabled={saving === user.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            user.unlimited ? "bg-sage" : "bg-gray-200"
                          } ${saving === user.id ? "opacity-50" : ""}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                              user.unlimited ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-navy text-sm mb-3">Setup Instructions</h3>
            <div className="text-xs text-gray-500 space-y-2">
              <p>1. Go to your Supabase SQL Editor and run the SQL from <code className="bg-gray-100 px-1 rounded">sql/usage-tracking.sql</code></p>
              <p>2. After your account is created, find your user ID in Supabase → Authentication → Users</p>
              <p>3. Run in SQL Editor: <code className="bg-gray-100 px-1 rounded">INSERT INTO admin_users (user_id) VALUES (&apos;your-user-id-here&apos;);</code></p>
              <p>4. Refresh this page — you&apos;ll see the admin dashboard</p>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
