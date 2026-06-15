import { Role } from '../types';
import { roleNames, roleColors } from '../data/initialData';
import { useStore } from '../store/useStore';
import { Store, Wrench, Users, ClipboardCheck, Shield } from 'lucide-react';
import { clsx } from 'clsx';

const roleIcons: Record<Role, React.ReactNode> = {
  store: <Store className="w-5 h-5" />,
  dispatch: <Users className="w-5 h-5" />,
  engineer: <Wrench className="w-5 h-5" />,
  quality: <ClipboardCheck className="w-5 h-5" />,
  admin: <Shield className="w-5 h-5" />,
};

const roles: Role[] = ['store', 'dispatch', 'engineer', 'quality', 'admin'];

export function RoleSwitcher() {
  const { currentRole, setRole } = useStore();

  return (
    <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1.5">
      {roles.map((role) => {
        const isActive = currentRole === role;
        const color = roleColors[role];
        
        return (
          <button
            key={role}
            onClick={() => setRole(role)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200',
              isActive
                ? 'text-white shadow-lg scale-105'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            )}
            style={{
              backgroundColor: isActive ? color : 'transparent',
              boxShadow: isActive ? `0 4px 20px ${color}40` : 'none',
            }}
          >
            {roleIcons[role]}
            <span className="text-sm">{roleNames[role]}</span>
          </button>
        );
      })}
    </div>
  );
}
