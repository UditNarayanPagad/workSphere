import type { NotificationItem } from "../types";

export interface NotificationInboxProps {
  notifications: NotificationItem[];
  onRefresh: () => void;
  onMarkRead: (notificationId: string) => void;
}

export default function NotificationInbox({
  notifications,
  onRefresh,
  onMarkRead
}: NotificationInboxProps) {
  return (
    <section className="notification-inbox" aria-label="Notifications">
      <div className="notification-inbox__heading">
        <h3>Notifications</h3>
        <div>
          <span>{notifications.filter(({ readAt }) => !readAt).length} new</span>
          <button type="button" onClick={onRefresh}>Refresh</button>
        </div>
      </div>
      {notifications.length ? (
        <ul className="notification-list">
          {notifications.slice(0, 5).map((notification) => (
            <li
              className={notification.readAt ? "notification-item" : "notification-item is-unread"}
              key={notification.id}
            >
              <div>
                <p>{notification.message}</p>
                <time dateTime={notification.createdAt}>
                  {new Date(notification.createdAt).toLocaleDateString()}
                </time>
              </div>
              {!notification.readAt && (
                <button
                  type="button"
                  className="notification-item__read"
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="workspace-empty">You’re all caught up.</p>
      )}
    </section>
  );
}
