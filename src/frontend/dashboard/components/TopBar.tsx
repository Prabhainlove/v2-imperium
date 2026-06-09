import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@frontend/auth/session";
import { IconGem, IconCoin, IconPlus, IconGear } from "./icons";

interface Props { gems: number; coins: number; }

export function TopBar({ gems, coins }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleLogout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="dash-topbar">
      <div className="dash-brand">
        <div className="dash-brand-dots" aria-hidden>
          <span style={{ background: "#ee7b5a" }} />
          <span style={{ background: "#f5c452" }} />
          <span style={{ background: "#7fc7b8" }} />
          <span style={{ background: "#b9a7e0" }} />
        </div>
        <div className="dash-brand-text">
          <div className="name">IMPERIUM</div>
          <div className="sub">MAGNIFICENCE OF CAREERS</div>
        </div>
      </div>

      <div className="dash-resources">
        <div className="dash-resource">
          <div className="icon" style={{ background: "#ee7b5a" }}><IconGem width={16} height={16} /></div>
          <span>{gems.toLocaleString()}</span>
          <button className="plus" aria-label="Add gems"><IconPlus width={12} height={12} /></button>
        </div>
        <div className="dash-resource">
          <div className="icon" style={{ background: "#f5c452" }}><IconCoin width={16} height={16} /></div>
          <span>{coins.toLocaleString()}</span>
          <button className="plus" aria-label="Add coins"><IconPlus width={12} height={12} /></button>
        </div>
      </div>

      <div className="dash-gear-wrap" ref={ref}>
        <button className="dash-gear" aria-label="Settings" onClick={() => setOpen((v) => !v)}>
          <IconGear width={20} height={20} />
        </button>
        {open && (
          <div className="dash-settings-pop" role="menu">
            <button onClick={() => { setOpen(false); navigate({ to: "/profile" }); }}>Profile Settings</button>
            <button onClick={() => { setOpen(false); navigate({ to: "/settings" }); }}>Account</button>
            <button onClick={() => setOpen(false)}>Theme</button>
            <button onClick={() => { setOpen(false); handleLogout(); }}>Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}
