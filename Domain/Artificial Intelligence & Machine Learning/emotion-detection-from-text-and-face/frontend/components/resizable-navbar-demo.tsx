"use client";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { useState } from "react";

export default function NavbarDemo() {
  const navItems = [
    {
      name: "Features",
      link: "#features",
    },
    {
      name: "Pricing",
      link: "#pricing",
    },
    {
      name: "Contact",
      link: "#contact",
    },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="relative w-full">
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-4">
            <NavbarButton variant="secondary">Login</NavbarButton>
            <NavbarButton variant="primary">Book a call</NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300 transition-colors hover:text-black dark:hover:text-white"
              >
                <span className="block h-full w-full py-2">{item.name}</span>
              </a>
            ))}
            <div className="flex w-full flex-col gap-4 mt-4">
              <NavbarButton
                onClick={() => setIsMobileMenuOpen(false)}
                variant="primary"
                className="w-full"
              >
                Login
              </NavbarButton>
              <NavbarButton
                onClick={() => setIsMobileMenuOpen(false)}
                variant="primary"
                className="w-full"
              >
                Book a call
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <DummyContent />
    </div>
  );
}

const DummyContent = () => {
  return (
    <div className="container mx-auto p-8 pt-32">
      <h1 className="mb-4 text-center text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
        Resizable Navbar Experience
      </h1>
      <p className="mb-12 text-center text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
        Scroll down to see the Navbar transform into a floating pill. 
        It's designed for premium landing pages with a focus on both branding and motion.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-4">
        {[
          { id: 1, title: "The", width: "md:col-span-1", bg: "bg-blue-500/10 border-blue-500/20" },
          { id: 2, title: "First", width: "md:col-span-2", bg: "bg-purple-500/10 border-purple-500/20" },
          { id: 3, title: "Rule", width: "md:col-span-1", bg: "bg-pink-500/10 border-pink-500/20" },
          { id: 4, title: "Of", width: "md:col-span-3", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { id: 5, title: "F", width: "md:col-span-1", bg: "bg-orange-500/10 border-orange-500/20" },
          { id: 6, title: "Club", width: "md:col-span-2", bg: "bg-indigo-500/10 border-indigo-500/20" },
          { id: 7, title: "Is", width: "md:col-span-2", bg: "bg-rose-500/10 border-rose-500/20" },
          { id: 8, title: "You", width: "md:col-span-1", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { id: 9, title: "Do NOT TALK about", width: "md:col-span-2", bg: "bg-amber-500/10 border-amber-500/20" },
          { id: 10, title: "F Club", width: "md:col-span-1", bg: "bg-violet-500/10 border-violet-500/20" },
        ].map((box) => (
          <div
            key={box.id}
            className={`${box.width} h-64 ${box.bg} border flex items-center justify-center rounded-2xl p-4 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] duration-300`}
          >
            <h2 className="text-2xl font-bold tracking-tight">{box.title}</h2>
          </div>
        ))}
      </div>
    </div>
  );
};
