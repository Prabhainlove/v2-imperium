import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@frontend/landing/assets/imperium_logo.png";
import "../auth.css";

interface Props {
  mode: "signin" | "signup";
  intro: ReactNode;
  heading: string;
  children: ReactNode;
}

export function AuthShell({ mode, intro, heading, children }: Props) {
  return (
    <div className="auth-root">
      <div className="auth-guides" aria-hidden />
      <div className="auth-cross" aria-hidden />

      <header className="auth-top">
        <div className="auth-top-right">
          <nav className="auth-toggle" aria-label="Auth mode">
            <Link to="/auth" data-active={mode === "signin"}>Sign In</Link>
            <Link to="/signup" data-active={mode === "signup"}>Sign Up</Link>
          </nav>
          <span className="auth-percent">10%</span>
        </div>
      </header>

      <section className="auth-main">
        <div className="auth-left">
          <div className="auth-intro">
            <div className="auth-icon">
              <img src={logo} alt="" />
            </div>
            <p className="auth-intro-text">
              <span className="auth-brand">IMPERIUM</span> {intro}
            </p>
          </div>

          <div className="auth-video" aria-label="Intro video placeholder">
            <div className="auth-video-label">VIDEO COMING SOON</div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-arrow" aria-hidden>↓</div>
          <h1 className="auth-heading">{heading}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}
