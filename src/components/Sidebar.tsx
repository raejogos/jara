interface SidebarProps {
  activeTab: "download" | "convert" | "queue" | "settings" | "about";
  onTabChange: (tab: "download" | "convert" | "queue" | "settings" | "about") => void;
  queueCount: number;
}

export function Sidebar({ activeTab, onTabChange, queueCount }: SidebarProps) {
  const topNavItems = [
    { id: "download" as const, icon: DownloadIcon, label: "Baixar" },
    { id: "convert" as const, icon: ConvertIcon, label: "Converter" },
    { id: "queue" as const, icon: QueueIcon, label: "Fila", badge: queueCount },
    { id: "settings" as const, icon: SettingsIcon, label: "Configurações" },
  ];

  const bottomNavItems = [
    { id: "about" as const, icon: AboutIcon, label: "Sobre" },
  ];

  return (
    <aside className="w-16 h-full bg-dark-900 border-r border-dark-700 flex flex-col items-center py-4">
      {/* Logo - will use custom icon */}
      <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center mb-8 overflow-hidden">
        <img 
          src="/icon.png" 
          alt="Jara" 
          className="w-6 h-6 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = `
              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            `;
          }}
        />
      </div>

      {/* Top Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {topNavItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <nav className="flex flex-col gap-2">
        {bottomNavItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

interface NavButtonProps {
  item: {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badge?: number;
  };
  isActive: boolean;
  onClick: () => void;
}

function NavButton({ item, isActive, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        isActive
          ? "bg-white text-black"
          : "text-gray-500 hover:text-white hover:bg-dark-700"
      }`}
      title={item.label}
    >
      <item.icon className="w-5 h-5" />
      
      {/* Badge */}
      {item.badge !== undefined && item.badge > 0 && (
        <span className={`absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center ${
          isActive ? "bg-black text-white" : "bg-white text-black"
        }`}>
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      )}

      {/* Tooltip */}
      <span className="absolute left-14 px-2 py-1 bg-dark-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {item.label}
      </span>
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function ConvertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function AboutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
