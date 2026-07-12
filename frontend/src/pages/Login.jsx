import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { FlaskConical, ShieldCheck } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@stockregister.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (role) => {
    if (role === "admin") {
      setEmail("admin@stockregister.com"); setPassword("admin123");
    } else {
      setEmail("staff@stockregister.com"); setPassword("staff123");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left form */}
      <div className="flex items-center justify-center px-8 py-16">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-md bg-indigo-950 text-white grid place-items-center">
              <FlaskConical size={18} />
            </div>
            <div>
              <div className="font-heading font-bold text-slate-900">Stock Register</div>
              <div className="text-xs text-slate-500">MDS · VPD · Media</div>
            </div>
          </div>

          <h1 className="text-3xl font-heading font-bold text-slate-900 tracking-tight">
            Sign in to your workspace
          </h1>
          <p className="text-sm text-slate-500 mt-2 mb-8">
            Track receipts, issues and utilisation across departments.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="w-full bg-indigo-950 hover:bg-indigo-900 text-white"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Card
              onClick={() => setDemo("admin")}
              data-testid="demo-admin"
              className="p-3 cursor-pointer hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck size={14} className="text-indigo-700" /> Admin demo
              </div>
              <div className="text-xs text-slate-500 mt-1">admin@stockregister.com</div>
            </Card>
            <Card
              onClick={() => setDemo("staff")}
              data-testid="demo-staff"
              className="p-3 cursor-pointer hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck size={14} className="text-sky-700" /> Staff demo
              </div>
              <div className="text-xs text-slate-500 mt-1">staff@stockregister.com</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Right visual */}
      <div className="hidden lg:block relative">
        <img
          alt="Molecular diagnostics laboratory"
          src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-indigo-950/40" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="text-xs uppercase tracking-widest opacity-80">Molecular Diagnostics OS</div>
          <div className="text-3xl font-heading font-bold mt-2 max-w-md leading-tight">
            PCR-grade stock control for MDS · VPD · Media.
          </div>
        </div>
      </div>
    </div>
  );
}
