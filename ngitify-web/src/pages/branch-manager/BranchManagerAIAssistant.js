import React from 'react';
import { FaChartLine, FaHeadset, FaLock, FaPaperPlane, FaRobot, FaSearch } from 'react-icons/fa';
import styles from '../../styles/branch-manager/BranchManagerAIAssistant.module.css';

const SUGGESTED_PROMPTS = [
    "Summarize today's branch appointments, queue, and pending approvals.",
    'Show me where to manage branch patients, dentists, and secretaries.',
    'Which notifications or queue updates need immediate branch follow-up?',
    'Give me a quick guide for handling a guest appointment request in my branch.',
];

export default function BranchManagerAIAssistant() {
    return (
        <main className={styles.page}>
            <section className={styles.heroCard}>
                <div className={styles.heroIconWrap}>
                    <FaRobot className={styles.heroIcon} />
                </div>
                <div>
                    <p className={styles.eyebrow}>NgitiBot</p>
                    <h1 className={styles.title}>Branch manager NgitiBot workspace preview</h1>
                    <p className={styles.subtitle}>
                        This frontend preview shows how branch manager NgitiBot will look once
                        the guided work helper is finalized. The live NgitiBot workflow is intentionally
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
                                Example prompts branch managers can use once the assistant is fully wired.
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
                        <FaHeadset className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Planned Help Scope</h2>
                            <p className={styles.panelText}>
                                The branch manager assistant is planned to support questions such as:
                            </p>
                        </div>
                    </div>

                    <ul className={styles.scopeList}>
                        <li>finding the correct branch workflow without manually searching screen by screen</li>
                        <li>summarizing branch appointments, queue activity, and staff-facing alerts in plain language</li>
                        <li>surfacing branch-scoped patient and user management steps faster inside NgitiFy</li>
                        <li>turning branch operations questions into clear action guidance for daily clinic work</li>
                    </ul>
                </article>
            </section>

            <section className={styles.chatShell}>
                <div className={styles.chatHeader}>
                    <FaChartLine className={styles.chatHeaderIcon} />
                    <div>
                        <h2 className={styles.chatTitle}>Preview Conversation Area</h2>
                        <p className={styles.chatSubtitle}>
                            Layout only. Messages are not sent yet in this branch manager preview.
                        </p>
                    </div>
                </div>

                <div className={styles.mockMessages}>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        I'll eventually help you surface branch-level tasks, records, and follow-up actions more quickly.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.userBubble}`}>
                        What should I review first for today's branch operations?
                    </div>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        Planned response: point you to pending appointments, queue entries, unread notifications, and branch inventory alerts.
                    </div>
                </div>

                <div className={styles.inputRow}>
                    <div className={styles.disabledInput}>Ask NgitiBot about your branch workflow...</div>
                    <button type="button" className={styles.sendBtn} disabled>
                        <FaPaperPlane />
                    </button>
                </div>
            </section>
        </main>
    );
}
