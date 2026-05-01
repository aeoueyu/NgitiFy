import React from 'react';
import { FaChartLine, FaLock, FaPaperPlane, FaRobot, FaSearch, FaUsersCog } from 'react-icons/fa';
import styles from '../../styles/owner/OwnerAIAssistant.module.css';

const SUGGESTED_PROMPTS = [
    "Summarize today's clinic performance and pending approvals.",
    'Which branches need attention based on appointments and inventory alerts?',
    'Show me where to review owner-level activity logs and notifications.',
    'Draft a short checklist for opening a new branch inside NgitiFy.',
];

export default function OwnerAIAssistant() {
    return (
        <main className={styles.page}>
            <section className={styles.heroCard}>
                <div className={styles.heroIconWrap}>
                    <FaRobot className={styles.heroIcon} />
                </div>
                <div>
                    <p className={styles.eyebrow}>AI Staff Assistant</p>
                    <h1 className={styles.title}>Owner-side AI workspace preview</h1>
                    <p className={styles.subtitle}>
                        This preview shows the future owner AI assistant experience for answering
                        workflow questions, surfacing records, and guiding you through NgitiFy.
                        The live AI behavior is intentionally not enabled yet.
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
                                Example prompts the owner can use once the assistant is fully connected.
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
                        <FaUsersCog className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Planned Help Scope</h2>
                            <p className={styles.panelText}>
                                The owner assistant is planned to help with system-aware questions like:
                            </p>
                        </div>
                    </div>

                    <ul className={styles.scopeList}>
                        <li>finding the right management module without manually searching across screens</li>
                        <li>summarizing appointments, notifications, and branch performance in plain language</li>
                        <li>pointing to user management, inventory, and activity-log actions that need attention</li>
                        <li>turning owner questions into faster step-by-step guidance inside NgitiFy</li>
                    </ul>
                </article>
            </section>

            <section className={styles.chatShell}>
                <div className={styles.chatHeader}>
                    <FaChartLine className={styles.chatHeaderIcon} />
                    <div>
                        <h2 className={styles.chatTitle}>Preview Conversation Area</h2>
                        <p className={styles.chatSubtitle}>
                            Layout only. Messages are not sent yet in this owner preview.
                        </p>
                    </div>
                </div>

                <div className={styles.mockMessages}>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        I'll eventually help you surface owner-level insights, follow-up items, and system workflows more quickly.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.userBubble}`}>
                        Show me the fastest way to review pending appointments, low stock alerts, and recent staff activity.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        Planned response: guide you to the dashboard summary cards, notifications, inventory tracker, and activity logs.
                    </div>
                </div>

                <div className={styles.inputRow}>
                    <div className={styles.disabledInput}>Ask the AI assistant about your owner workflow...</div>
                    <button type="button" className={styles.sendBtn} disabled>
                        <FaPaperPlane />
                    </button>
                </div>
            </section>
        </main>
    );
}
