import { create } from 'zustand';

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

interface NotificationStore {
    notifications: Notification[];
    add: (notification: Omit<Notification, 'id'>) => void;
    remove: (id: string) => void;
}

export const useNotifications = create<NotificationStore>((set) => ({
    notifications: [],
    add: (notification) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
            notifications: [...state.notifications, { ...notification, id }]
        }));

        // Auto-remove after duration
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter(n => n.id !== id)
            }));
        }, notification.duration || 5000);
    },
    remove: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
    }))
}));
