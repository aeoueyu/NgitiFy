import React from 'react';
import { FaChartLine, FaLock, FaPaperPlane, FaRobot, FaSearch, FaUserShield } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/CoAdminAIAssistant.module.css';

const SUGGESTED_PROMPTS = [
    "Summarize today's operational priorities and pending approvals.",
    'Show me where to manage staff, branches, appointments, and inventory.',
    'Which notifications or activity logs need immediate co-admin attention?',
    'Give me a quick guide for common NgitiFy admin workflows.',
];

export default function CoAdminAIAssistant() {
    const { user } = useAuth();
    const isAdministrator = user?.role === 'administrator';
    const title = isAdministrator ? 'Administrator AI workspace preview' : 'Co-administrator AI workspace preview';
    const roleLabel = isAdministrator ? 'administrator' : 'co-administrator';
    const helperScopeLabel = isAdministrator ? 'admin assistant' : 'co-admin assistant';

    return (
        <main className={styles.page}>
            <section className={styles.heroCard}>
                <div className={styles.heroIconWrap}>
                    <FaRobot className={styles.heroIcon} />
                </div>
                <div>
                    <p className={styles.eyebrow}>AI Staff Assistant</p>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>
                        This frontend preview shows how the {roleLabel} AI helper will look once
                        the guided work assistant is finalized. The live AI workflow is intentionally
                        not enabled here yet.
                    </p>
                </div>
                <div className={styles.statusBadge}>
                    <FaLock />
                    Frontend Only
                </div>
            </section>

            <section className={styles.mainGrid}>
                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <FaSearch className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Suggested Requests</h2>
                            <p className={styles.panelText}>
                                Example prompts the admin team can use once the assistant is fully wired.
                            </p>
                        </div>
                    </div>

                    <div className={styles.promptList}>
                        {SUGGESTED_PROMPTS.map((prompt) => (
                            <button key={prompt} type="button" className={styles.promptChip}>
                                {prompt}
                            </button>
                        ))}
                    </div>
                </article>

                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <FaUserShield className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Planned Help Scope</h2>
                            <p className={styles.panelText}>
                                The {helperScopeLabel} is planned to support questions such as:
                            </p>
                        </div>
                    </div>

                    <ul className={styles.scopeList}>
                        <li>finding the right admin workflow without manually searching screen by screen</li>
                        <li>summarizing appointments, inventory alerts, notifications, and activity logs in plain language</li>
                        <li>surfacing user-management, branch, and configuration steps faster inside NgitiFy</li>
                        <li>helping with day-to-day system operations while respecting administrator-only ownership actions</li>
                    </ul>
                </article>
            </section>

            <section className={styles.chatShell}>
                <div className={styles.chatHeader}>
                    <FaChartLine className={styles.chatHeaderIcon} />
                    <div>
                        <h2 className={styles.chatTitle}>Preview Conversation Area</h2>
                        <p className={styles.chatSubtitle}>
                            Layout only. Messages are not sent yet in this admin-tier preview.
                        </p>
                    </div>
                </div>

                <div className={styles.mockMessages}>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        I&apos;ll eventually help you surface admin workflows, records, and follow-up items more quickly.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.userBubble}`}>
                        What should I review first across appointments, users, inventory, and notifications today?
                    </div>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        Planned response: point you to pending appointments, low-stock alerts, unread notifications, and recent activity.
                    </div>
                </div>

                <div className={styles.inputRow}>
                    <div className={styles.disabledInput}>Ask the AI assistant about your admin workflow...</div>
                    <button type="button" className={styles.sendBtn} disabled>
                        <FaPaperPlane />
                    </button>
                </div>
            </section>
        </main>
    );
}
