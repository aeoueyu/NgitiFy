import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionLabel,
  SurfaceCard,
} from '../../components/mobile/MobileUI';

import { mobileTheme } from '../../theme/mobileTheme';
import { AuthContext } from '../../context/AuthContext';
import CustomModal from '../../components/CustomModal';
import {
  getStaticOralCarePreview,
} from '../../utils/oralCarePreview';
const { buildFrequencyRows, buildTrendChartData, getRecentCheckIns } = require('../../utils/oralCareTrends');

const NAV_ITEMS = [
  {
    id: 'today',
    label: 'Today',
  },
  {
    id: 'calendar',
    label: 'Calendar',
  },
  {
    id: 'trends',
    label: 'Trends',
  },
  {
    id: 'education',
    label: 'Learn',
  },
];

const TREND_WINDOWS = [
  {
    days: 7,
    label: '7 days',
  },
  {
    days: 30,
    label: '30 days',
  },
];

const SEVERITY_OPTIONS = [
  'Mild',
  'Moderate',
  'Severe',
];

const toDateKey = (
  value = new Date(),
) => {
  const date = new Date(value);

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const fromDateKey = (
  dateKey,
) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(dateKey || ''),
    )
  ) {
    return null;
  }

  const date =
    new Date(
      `${dateKey}T12:00:00`,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
};

const addDays = (
  value,
  amount,
) => {
  const date = new Date(value);

  date.setDate(
    date.getDate() + amount,
  );

  return date;
};

const startOfWeekMonday = (
  value,
) => {
  const date = new Date(value);

  const day =
    date.getDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  return addDays(
    date,
    offset,
  );
};

const formatLongDate = (
  dateKey,
) => {
  const date =
    fromDateKey(dateKey);

  if (!date) {
    return 'Selected date';
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  );
};

const isFutureDate = (
  dateKey,
) => {
  return String(dateKey || '')
    > toDateKey();
};

const findLogByDate = (
  logs,
  dateKey,
) => {
  return (
    Array.isArray(logs)
      ? logs
      : []
  ).find(
    (log) =>
      log?.logDateKey
      === dateKey,
  ) || null;
};

const normalizeSymptomDetails = (
  value,
) => {
  if (
    !value
    || typeof value !== 'object'
  ) {
    return {};
  }

  return Object.entries(value)
    .reduce(
      (
        result,
        [
          symptomId,
          details,
        ],
      ) => {
        if (
          !details
          || typeof details
            !== 'object'
        ) {
          return result;
        }

        result[symptomId] = {
          severity:
            String(
              details.severity
              || '',
            ),
          duration:
            String(
              details.duration
              || '',
            ),
        };

        return result;
      },
      {},
    );
};

const buildGroupsForLog = (
  definitions,
  log,
) => {
  const symptoms =
    Array.isArray(log?.symptoms)
      ? log.symptoms
      : [];

  const dailyCare =
    Array.isArray(log?.dailyCare)
      ? log.dailyCare
      : [];

  const riskFactors =
    Array.isArray(log?.riskFactors)
      ? log.riskFactors
      : [];

  return (
    Array.isArray(definitions)
      ? definitions
      : []
  ).map((group) => ({
    ...group,

    items: (
      Array.isArray(group?.items)
        ? group.items
        : []
    ).map((item) => ({
      ...item,

      selected:
        group.id === 'symptoms'
          ? symptoms.includes(
              item.id,
            )
          : group.id
              === 'riskFactors'
            ? riskFactors.includes(
                item.id,
              )
            : dailyCare.includes(
                item.id,
              ),
    })),
  }));
};

const getLabelMap = (
  groups,
) => {
  const labels = {};

  (
    Array.isArray(groups)
      ? groups
      : []
  ).forEach((group) => {
    (
      Array.isArray(group?.items)
        ? group.items
        : []
    ).forEach((item) => {
      if (item?.id) {
        labels[item.id] =
          item.label
          || item.id;
      }
    });
  });

  return labels;
};

function SheetHeader({
  title,
  subtitle,
  onClose,
}) {
  return (
    <View
      style={styles.sheetHeader}
    >
      <View
        style={styles.sheetHeaderCopy}
      >
        <Text
          style={styles.sheetTitle}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            style={
              styles.sheetSubtitle
            }
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={
          styles.sheetCloseButton
        }
        activeOpacity={0.8}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons
          name="close"
          size={19}
          color={
            mobileTheme.colors.text
          }
        />
      </TouchableOpacity>
    </View>
  );
}

function FactorRow({
  item,
  onToggle,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.factorRow,

        item.active
          && styles.factorRowActive,
      ]}
      onPress={() =>
        onToggle(item.id)
      }
    >
      <Text
        style={[
          styles.factorLabel,

          item.active
            && styles
              .factorLabelActive,
        ]}
      >
        {item.label}
      </Text>

      <View
        style={[
          styles.factorToggle,

          item.active
            && styles
              .factorToggleActive,
        ]}
      >
        {item.active ? (
          <Ionicons
            name="checkmark"
            size={15}
            color="#ffffff"
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function TrendFrequencyCard({
  title,
  icon,
  rows,
  totalLogs,
  emptyMessage,
}) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  return (
    <SurfaceCard
      style={styles.trendCard}
    >
      <View
        style={
          styles.trendCardHeader
        }
      >
        <View
          style={
            styles.trendIcon
          }
        >
          <Ionicons
            name={icon}
            size={19}
            color={
              mobileTheme.colors
                .primaryDark
            }
          />
        </View>

        <Text
          style={styles.trendTitle}
        >
          {title}
        </Text>
      </View>

      {rows.length ? (
        rows.map((row) => (
          <View
            key={row.id}
            style={styles.trendRow}
          >
            <View
              style={
                styles.trendRowCopy
              }
            >
              <Text
                style={
                  styles.trendRowTitle
                }
              >
                {row.label}
              </Text>

              <Text
                style={
                  styles.trendRowMeta
                }
              >
                {row.count} of{' '}
                {totalLogs} logged{' '}
                {totalLogs === 1
                  ? 'day'
                  : 'days'}
              </Text>
            </View>

            <View style={styles.trendBarTrack} accessibilityLabel={`${row.label}: ${row.count} of ${totalLogs} logged days`}>
              <View style={[styles.trendBarFill, { width: `${Math.max(8, (row.count / maxCount) * 100)}%` }]} />
            </View>
          </View>
        ))
      ) : (
        <Text
          style={
            styles.emptyBody
          }
        >
          {emptyMessage}
        </Text>
      )}
    </SurfaceCard>
  );
}

function TrendTimelineChart({ data }) {
  const maxValue = Math.max(1, ...data.map((item) => item.dailyCareCount + item.symptomCount + item.riskFactorCount));
  return <SurfaceCard style={styles.trendCard}>
    <Text style={styles.trendTitle}>Check-ins over time</Text>
    <Text style={styles.cardBody}>Each bar shows how many care habits, symptoms, and other factors you saved that day.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineChart} accessibilityLabel="Saved oral health check-ins by date">
      {data.map((item) => {
        const total = item.dailyCareCount + item.symptomCount + item.riskFactorCount;
        const dateLabel = formatLongDate(item.date);
        return <View key={item.date} style={styles.timelineColumn} accessible accessibilityLabel={`${dateLabel}: ${total} saved items`}>
          <View style={styles.timelineBarArea}><View style={[styles.timelineBar, { height: Math.max(6, (total / maxValue) * 82) }]} /></View>
          <Text style={styles.timelineValue}>{total}</Text><Text style={styles.timelineDate}>{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</Text>
        </View>;
      })}
    </ScrollView>
  </SurfaceCard>;
}

export default function OralCareInsightsScreen({
  navigation,
  route,
}) {
  const {
    userToken,
    API_BASE_URL,
  } = useContext(AuthContext);

  const todayKey =
    useMemo(
      () => toDateKey(),
      [],
    );

  const [
    activeTab,
    setActiveTab,
  ] = useState('today');

  const [
    selectedDateKey,
    setSelectedDateKey,
  ] = useState(todayKey);

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    todayKey.slice(0, 7),
  );

  const [
    oralHealth,
    setOralHealth,
  ] = useState(
    route?.params?.oralHealth
    || null,
  );

  const [
    visitPrediction,
    setVisitPrediction,
  ] = useState(
    route?.params
      ?.visitPrediction
    || null,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    !route?.params?.oralHealth,
  );

  const [
    loadError,
    setLoadError,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    factors,
    setFactors,
  ] = useState([]);

  const [
    logGroups,
    setLogGroups,
  ] = useState([]);

  const [
    logNotes,
    setLogNotes,
  ] = useState('');

  const [
    symptomDetails,
    setSymptomDetails,
  ] = useState({});

  const [
    symptomDetailId,
    setSymptomDetailId,
  ] = useState(null);

  const [
    factorsVisible,
    setFactorsVisible,
  ] = useState(false);

  const [
    logVisible,
    setLogVisible,
  ] = useState(false);

  const [
    logStep,
    setLogStep,
  ] = useState(0);

  const [
    trendDays,
    setTrendDays,
  ] = useState(7);

  const [
    educationQuery,
    setEducationQuery,
  ] = useState('');

  const [
    educationCategory,
    setEducationCategory,
  ] = useState('all');

  const [
    selectedEducationArticle,
    setSelectedEducationArticle,
  ] = useState(null);

  const [
    noticeModal,
    setNoticeModal,
  ] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning',
  });

  const logSuccessModalTimer =
    useRef(null);

  const showNoticeModal = useCallback((
    title,
    message,
    type = 'warning',
  ) => {
    setNoticeModal({
      visible: true,
      title,
      message,
      type,
    });
  }, []);

  const closeNoticeModal = useCallback(() => {
    setNoticeModal((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  useEffect(() => () => {
    if (logSuccessModalTimer.current) {
      clearTimeout(
        logSuccessModalTimer.current,
      );
    }
  }, []);

  const preview =
    useMemo(
      () =>
        getStaticOralCarePreview(
          visitPrediction,
          oralHealth,
        ),
      [
        visitPrediction,
        oralHealth,
      ],
    );

  const logs =
    useMemo(
      () => (
        Array.isArray(
          oralHealth?.logs,
        )
          ? oralHealth.logs
          : []
      ),
      [oralHealth?.logs],
    );

  const selectedLog =
    useMemo(
      () =>
        findLogByDate(
          logs,
          selectedDateKey,
        ),
      [
        logs,
        selectedDateKey,
      ],
    );

  const logDefinitions =
    useMemo(
      () => (
        Array.isArray(
          preview.logGroups,
        )
          ? preview.logGroups
          : []
      ),
      [preview.logGroups],
    );

  const labels =
    useMemo(
      () =>
        getLabelMap(
          logDefinitions,
        ),
      [logDefinitions],
    );

  const selectedDateIsFuture =
    isFutureDate(
      selectedDateKey,
    );

  const fetchCareData =
    useCallback(async () => {
      if (
        !userToken
        || !API_BASE_URL
      ) {
        return;
      }

      setLoading(true);
      setLoadError('');

      try {
        const [
          oralHealthResult,
          visitPredictionResult,
        ] =
          await Promise.allSettled([
            fetch(
              `${API_BASE_URL}/api/my/oral-health`,
              {
                headers: {
                  Authorization:
                    `Bearer ${userToken}`,
                },
              },
            ),

            fetch(
              `${API_BASE_URL}/api/my/visit-prediction`,
              {
                headers: {
                  Authorization:
                    `Bearer ${userToken}`,
                },
              },
            ),
          ]);

        if (
          oralHealthResult.status
          === 'fulfilled'
        ) {
          const response =
            oralHealthResult.value;

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (response.ok) {
            setOralHealth(payload);
          } else if (
            !route?.params
              ?.oralHealth
          ) {
            throw new Error(
              payload.message
              || 'Could not load Oral Health Management.',
            );
          }
        } else if (
          !route?.params
            ?.oralHealth
        ) {
          throw new Error(
            'Unable to connect to Oral Health Management.',
          );
        }

        if (
          visitPredictionResult.status
          === 'fulfilled'
        ) {
          const response =
            visitPredictionResult.value;

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (response.ok) {
            setVisitPrediction(
              payload?.prediction
              || null,
            );
          } else if (
            !route?.params
              ?.visitPrediction
          ) {
            setVisitPrediction(null);
          }
        } else if (
          !route?.params
            ?.visitPrediction
        ) {
          setVisitPrediction(null);
        }
      } catch (error) {
        const message =
          error.message
          || 'Unable to load your Oral Health Management information.';

        setLoadError(message);

        showNoticeModal(
          'Oral Health Management',
          message,
          'error',
        );
      } finally {
        setLoading(false);
      }
    }, [
      API_BASE_URL,
      route?.params?.oralHealth,
      route?.params
        ?.visitPrediction,
      showNoticeModal,
      userToken,
    ]);

  useEffect(() => {
    fetchCareData();
  }, [fetchCareData]);

  useEffect(() => {
    setFactors(
      Array.isArray(
        preview.factors,
      )
        ? preview.factors
        : [],
    );
  }, [preview.factors]);

  useEffect(() => {
    setLogGroups(
      buildGroupsForLog(
        logDefinitions,
        selectedLog,
      ),
    );

    setLogNotes(
      selectedLog?.notes
      || '',
    );

    setSymptomDetails(
      normalizeSymptomDetails(
        selectedLog
          ?.symptomDetails,
      ),
    );
  }, [
    selectedDateKey,
    selectedLog,
    logDefinitions,
  ]);

  const activeFactors =
    useMemo(
      () =>
        factors.filter(
          (item) =>
            item.active
            && item.id !== 'none',
        ),
      [factors],
    );

  const selectedItems =
    useMemo(
      () =>
        logGroups.flatMap(
          (group) =>
            (
              Array.isArray(
                group.items,
              )
                ? group.items
                : []
            )
              .filter(
                (item) =>
                  item.selected,
              )
              .map((item) => ({
                ...item,
                groupId:
                  group.id,
              })),
        ),
      [logGroups],
    );

  const weekDays =
    useMemo(() => {
      const selectedDate =
        fromDateKey(
          selectedDateKey,
        )
        || new Date();

      const weekStart =
        startOfWeekMonday(
          selectedDate,
        );

      return Array.from(
        {
          length: 7,
        },
        (_, index) => {
          const date =
            addDays(
              weekStart,
              index,
            );

          const key =
            toDateKey(date);

          return {
            key,

            weekday:
              date.toLocaleDateString(
                'en-PH',
                {
                  weekday: 'short',
                },
              ),

            day:
              String(
                date.getDate(),
              ),

            hasLog:
              Boolean(
                findLogByDate(
                  logs,
                  key,
                ),
              ),
          };
        },
      );
    }, [
      logs,
      selectedDateKey,
    ]);

  const calendarMarks =
    useMemo(() => {
      const marks = {};

      logs.forEach((log) => {
        if (!log?.logDateKey) {
          return;
        }

        marks[
          log.logDateKey
        ] = {
          marked: true,

          dotColor:
            mobileTheme.colors
              .secondary,
        };
      });

      marks[selectedDateKey] = {
        ...(
          marks[
            selectedDateKey
          ] || {}
        ),

        selected: true,

        selectedColor:
          mobileTheme.colors
            .primaryDark,

        selectedTextColor:
          '#ffffff',
      };

      return marks;
    }, [
      logs,
      selectedDateKey,
    ]);

  const trendLogs =
    useMemo(() => {
      const startKey =
        toDateKey(
          addDays(
            new Date(),
            -(trendDays - 1),
          ),
        );

      return logs.filter(
        (log) => {
          const key =
            String(
              log?.logDateKey
              || '',
            );

          return (
            key >= startKey
            && key <= todayKey
          );
        },
      );
    }, [
      logs,
      todayKey,
      trendDays,
    ]);

  const careTrends =
    useMemo(
      () =>
        buildFrequencyRows({
          logs: trendLogs,
          field: 'dailyCare',
          labels,
        }),
      [
        trendLogs,
        labels,
      ],
    );

  const symptomTrends =
    useMemo(
      () =>
        buildFrequencyRows({
          logs: trendLogs,
          field: 'symptoms',
          labels,
        }),
      [
        trendLogs,
        labels,
      ],
    );

  const riskTrends =
    useMemo(
      () =>
        buildFrequencyRows({
          logs: trendLogs,
          field: 'riskFactors',
          labels,
        }),
      [
        trendLogs,
        labels,
      ],
    );

  const enoughTrendHistory =
    trendLogs.length >= 3;

  const trendChartData = useMemo(() => buildTrendChartData(logs, trendDays), [logs, trendDays]);

  /*
   * Keep Dental Health Education tied
   * directly to the shared backend payload.
   */
  const educationArticles =
    useMemo(
      () => (
        Array.isArray(
          oralHealth?.education,
        )
          ? oralHealth.education
          : []
      ),
      [oralHealth?.education],
    );

  const contextualEducation =
    useMemo(
      () => (
        Array.isArray(
          oralHealth
            ?.contextualEducation,
        )
          ? oralHealth
              .contextualEducation
              .slice(0, 3)
          : []
      ),
      [
        oralHealth
          ?.contextualEducation,
      ],
    );

  const educationCategories =
    useMemo(() => {
      const map =
        new Map();

      educationArticles
        .forEach((article) => {
          const label =
            String(
              article.category
              || 'Dental Health Education',
            ).trim();

          const id =
            String(
              article.categoryId
              || label
                .toLowerCase()
                .replace(
                  /[^a-z0-9]+/g,
                  '-',
                )
                .replace(
                  /^-+|-+$/g,
                  '',
                )
              || 'dental-health-education',
            );

          if (!map.has(id)) {
            map.set(
              id,
              {
                id,
                label,
              },
            );
          }
        });

      return Array.from(
        map.values(),
      );
    }, [educationArticles]);

  const filteredEducation =
    useMemo(() => {
      const query =
        educationQuery
          .trim()
          .toLowerCase();

      return educationArticles
        .filter((article) => {
          const categoryLabel =
            String(
              article.category
              || 'Dental Health Education',
            ).trim();

          const categoryId =
            String(
              article.categoryId
              || categoryLabel
                .toLowerCase()
                .replace(
                  /[^a-z0-9]+/g,
                  '-',
                )
                .replace(
                  /^-+|-+$/g,
                  '',
                )
              || 'dental-health-education',
            );

          if (
            educationCategory
              !== 'all'
            && categoryId
              !== educationCategory
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const text =
            [
              article.title,
              article.category,
              article.summary,
              article.body,
              article.action,

              ...(
                Array.isArray(
                  article.keywords,
                )
                  ? article.keywords
                  : []
              ),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return text.includes(
            query,
          );
        });
    }, [
      educationArticles,
      educationCategory,
      educationQuery,
    ]);

  const selectDate = (
    dateKey,
  ) => {
    if (!dateKey) {
      return;
    }

    if (
      isFutureDate(dateKey)
    ) {
      showNoticeModal(
        'Future Date',
        'Future dates cannot be edited in the Daily Oral Health Log.',
        'warning',
      );

      return;
    }

    setSelectedDateKey(
      dateKey,
    );

    setCalendarMonth(
      dateKey.slice(0, 7),
    );
  };

  const goToToday = () => {
    setSelectedDateKey(
      todayKey,
    );

    setCalendarMonth(
      todayKey.slice(0, 7),
    );

    setActiveTab('today');
  };

  const changeWeek = (
    direction,
  ) => {
    const current =
      fromDateKey(
        selectedDateKey,
      );

    if (!current) {
      return;
    }

    const next =
      addDays(
        current,
        direction * 7,
      );

    const nextKey =
      toDateKey(next);

    if (
      isFutureDate(nextKey)
    ) {
      setSelectedDateKey(
        todayKey,
      );

      return;
    }

    setSelectedDateKey(
      nextKey,
    );
  };

  const openLog = () => {
    if (
      selectedDateIsFuture
    ) {
      showNoticeModal(
        'Future Date',
        'Daily Oral Health Logs cannot be created for future dates.',
        'warning',
      );

      return;
    }

    setLogStep(0);
    setSymptomDetailId(null);
    setLogVisible(true);
  };

  const toggleFactor = (
    factorId,
  ) => {
    setFactors((current) => {
      if (
        factorId === 'none'
      ) {
        return current.map(
          (item) => ({
            ...item,

            active:
              item.id === 'none',
          }),
        );
      }

      return current.map(
        (item) => {
          if (
            item.id === factorId
          ) {
            return {
              ...item,
              active:
                !item.active,
            };
          }

          if (
            item.id === 'none'
          ) {
            return {
              ...item,
              active: false,
            };
          }

          return item;
        },
      );
    });
  };

  const toggleLogItem = (
    groupId,
    itemId,
  ) => {
    const group =
      logGroups.find(
        (entry) =>
          entry.id === groupId,
      );

    const currentItem =
      group?.items?.find(
        (item) =>
          item.id === itemId,
      );

    const willSelect =
      !currentItem?.selected;

    if (
      groupId === 'symptoms'
      && itemId
        === 'no-symptoms'
    ) {
      setLogGroups(
        (current) =>
          current.map(
            (entry) => {
              if (
                entry.id
                !== 'symptoms'
              ) {
                return entry;
              }

              return {
                ...entry,

                items:
                  entry.items.map(
                    (item) => ({
                      ...item,

                      selected:
                        item.id
                          === 'no-symptoms'
                          ? willSelect
                          : false,
                    }),
                  ),
              };
            },
          ),
      );

      setSymptomDetails(
        {},
      );

      setSymptomDetailId(
        null,
      );

      return;
    }

    setLogGroups(
      (current) =>
        current.map((entry) => {
          if (
            entry.id !== groupId
          ) {
            return entry;
          }

          return {
            ...entry,

            items:
              entry.items.map(
                (item) => {
                  if (
                    groupId
                      === 'symptoms'
                    && item.id
                      === 'no-symptoms'
                  ) {
                    return {
                      ...item,
                      selected: false,
                    };
                  }

                  if (
                    item.id
                    === itemId
                  ) {
                    return {
                      ...item,
                      selected:
                        willSelect,
                    };
                  }

                  return item;
                },
              ),
          };
        }),
    );

    if (
      groupId !== 'symptoms'
    ) {
      return;
    }

    if (!willSelect) {
      setSymptomDetails(
        (current) => {
          const next = {
            ...current,
          };

          delete next[itemId];

          return next;
        },
      );

      if (
        symptomDetailId
        === itemId
      ) {
        setSymptomDetailId(
          null,
        );
      }

      return;
    }

    const definition =
      logDefinitions
        .find(
          (entry) =>
            entry.id
            === 'symptoms',
        )
        ?.items
        ?.find(
          (item) =>
            item.id === itemId,
        );

    if (
      Array.isArray(
        definition?.detailFields,
      )
      && definition
        .detailFields.length
    ) {
      setSymptomDetails(
        (current) => ({
          ...current,

          [itemId]: {
            severity:
              current[itemId]
                ?.severity
              || '',

            duration:
              current[itemId]
                ?.duration
              || '',
          },
        }),
      );

      setSymptomDetailId(
        itemId,
      );
    }
  };

  const activeSymptom =
    useMemo(
      () =>
        logDefinitions
          .find(
            (group) =>
              group.id
              === 'symptoms',
          )
          ?.items
          ?.find(
            (item) =>
              item.id
              === symptomDetailId,
          )
        || null,
      [
        logDefinitions,
        symptomDetailId,
      ],
    );

  const updateSymptomDetail = (
    field,
    value,
  ) => {
    if (!symptomDetailId) {
      return;
    }

    setSymptomDetails(
      (current) => ({
        ...current,

        [symptomDetailId]: {
          severity:
            current[
              symptomDetailId
            ]?.severity
            || '',

          duration:
            current[
              symptomDetailId
            ]?.duration
            || '',

          [field]: value,
        },
      }),
    );
  };

    const activeLogGroup =
    useMemo(() => {
      const groupId =
        logStep === 0
          ? 'symptoms'
          : logStep === 1
            ? 'dailyCare'
            : logStep === 2
              ? 'riskFactors'
              : null;

      if (!groupId) {
        return null;
      }

      return (
        logGroups.find(
          (group) =>
            group.id === groupId,
        )
        || null
      );
    }, [
      logGroups,
      logStep,
    ]);

  const selectedLogItemsByGroup =
    useMemo(
      () => ({
        symptoms:
          logGroups
            .find(
              (group) =>
                group.id
                === 'symptoms',
            )
            ?.items
            ?.filter(
              (item) =>
                item.selected,
            )
            || [],

        dailyCare:
          logGroups
            .find(
              (group) =>
                group.id
                === 'dailyCare',
            )
            ?.items
            ?.filter(
              (item) =>
                item.selected,
            )
            || [],

        riskFactors:
          logGroups
            .find(
              (group) =>
                group.id
                === 'riskFactors',
            )
            ?.items
            ?.filter(
              (item) =>
                item.selected,
            )
            || [],
      }),
      [logGroups],
    );

  const dailyLogIsEmpty =
    selectedLogItemsByGroup
      .symptoms
      .length === 0
    && selectedLogItemsByGroup
      .dailyCare
      .length === 0
    && selectedLogItemsByGroup
      .riskFactors
      .length === 0
    && !logNotes.trim();

  const closeLog = () => {
    setLogVisible(false);
    setLogStep(0);
    setSymptomDetailId(null);
  };

  const goToPreviousLogStep =
    () => {
      setLogStep(
        (current) =>
          Math.max(
            0,
            current - 1,
          ),
      );
    };

  const goToNextLogStep =
    () => {
      setLogStep(
        (current) =>
          Math.min(
            3,
            current + 1,
          ),
      );
    };

  const saveFactors =
    async () => {
      setSaving(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/my/oral-health/factors`,
            {
              method: 'PATCH',

              headers: {
                Authorization:
                  `Bearer ${userToken}`,

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  factors:
                    factors
                      .filter(
                        (item) =>
                          item.active,
                      )
                      .map(
                        (item) =>
                          item.id,
                      ),
                }),
            },
          );

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.message
            || 'Failed to save oral health factors.',
          );
        }

        setOralHealth(payload);
        setFactorsVisible(false);

        showNoticeModal(
          'Oral Health Management',
          payload.message
          || 'Oral health factors saved.',
          'success',
        );
      } catch (error) {
        showNoticeModal(
          'Oral Health Management',
          error.message
          || 'Failed to save oral health factors.',
          'error',
        );
      } finally {
        setSaving(false);
      }
    };

  const saveDailyLog =
    async () => {
      if (
        selectedDateIsFuture
      ) {
        showNoticeModal(
          'Future Date',
          'Daily Oral Health Logs cannot be saved for future dates.',
          'warning',
        );

        return;
      }

      const symptoms =
        logGroups
          .find(
            (group) =>
              group.id
              === 'symptoms',
          )
          ?.items
          ?.filter(
            (item) =>
              item.selected,
          )
          .map(
            (item) =>
              item.id,
          )
        || [];

      const dailyCare =
        logGroups
          .find(
            (group) =>
              group.id
              === 'dailyCare',
          )
          ?.items
          ?.filter(
            (item) =>
              item.selected,
          )
          .map(
            (item) =>
              item.id,
          )
        || [];

      const riskFactors =
        logGroups
          .find(
            (group) =>
              group.id
              === 'riskFactors',
          )
          ?.items
          ?.filter(
            (item) =>
              item.selected,
          )
          .map(
            (item) =>
              item.id,
          )
        || [];

      if (
        symptoms.length === 0
        && dailyCare.length === 0
        && riskFactors.length === 0
        && !logNotes.trim()
      ) {
        showNoticeModal(
          'Incomplete Oral Health Log',
          'Select at least one symptom, care item, risk factor, or note before saving',
          'warning',
        );

        return;
      }

      const symptomIds =
        new Set(symptoms);

      const cleanDetails =
        Object.entries(
          symptomDetails,
        ).reduce(
          (
            result,
            [
              symptomId,
              details,
            ],
          ) => {
            if (
              !symptomIds.has(
                symptomId,
              )
            ) {
              return result;
            }

            const severity =
              String(
                details?.severity
                || '',
              ).trim();

            const duration =
              String(
                details?.duration
                || '',
              ).trim();

            if (
              severity
              || duration
            ) {
              result[
                symptomId
              ] = {
                severity,
                duration,
              };
            }

            return result;
          },
          {},
        );

      setSaving(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/my/oral-health/logs`,
            {
              method: 'POST',

              headers: {
                Authorization:
                  `Bearer ${userToken}`,

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  logDate:
                    selectedDateKey,

                  symptoms,
                  dailyCare,
                  riskFactors,

                  symptomDetails:
                    cleanDetails,

                  notes:
                    logNotes,
                }),
            },
          );

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.message
            || 'Failed to save daily oral health log.',
          );
        }

        setOralHealth(payload);

        const successMessage =
          selectedLog
            ? 'Daily oral health log updated'
            : 'Daily oral health log saved';

        closeLog();

        logSuccessModalTimer.current =
          setTimeout(() => {
            showNoticeModal(
              'Oral Health Management',
              successMessage,
              'success',
            );

            logSuccessModalTimer.current =
              null;
          }, 350);
      } catch (error) {
        showNoticeModal(
          'Oral Health Management',
          error.message
          || 'Failed to save daily oral health log.',
          'error',
        );
      } finally {
        setSaving(false);
      }
    };

  const renderWeekStrip =
    () => (
      <SurfaceCard
        style={styles.weekCard}
      >
        <View
          style={
            styles.weekTopRow
          }
        >
          <TouchableOpacity
            style={
              styles.weekArrow
            }
            onPress={() =>
              changeWeek(-1)
            }
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />
          </TouchableOpacity>

          <View
            style={
              styles.weekTitleWrap
            }
          >
            <Text
              style={
                styles.weekTitle
              }
            >
              {formatLongDate(
                selectedDateKey,
              )}
            </Text>

            <Text
              style={
                styles.weekSubtitle
              }
            >
              Select a day to load
              its saved Daily Oral
              Health Log.
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.weekArrow
            }
            onPress={() =>
              changeWeek(1)
            }
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.weekScroll
          }
        >
          {weekDays.map(
            (day) => {
              const selected =
                day.key
                === selectedDateKey;

              const future =
                isFutureDate(
                  day.key,
                );

              return (
                <TouchableOpacity
                  key={day.key}
                  style={[
                    styles.dayCard,

                    selected
                      && styles
                        .dayCardSelected,

                    future
                      && styles
                        .dayCardDisabled,
                  ]}
                  disabled={future}
                  activeOpacity={0.82}
                  onPress={() =>
                    selectDate(
                      day.key,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${day.weekday} ${day.day}. ${
                      day.hasLog
                        ? 'Oral health log saved.'
                        : future
                          ? 'Future date.'
                          : 'No oral health log saved.'
                    }`
                  }
                  accessibilityState={{
                    selected,
                    disabled: future,
                  }}
                >
                  <Text
                    style={[
                      styles.dayWeekday,

                      selected
                        && styles
                          .dayTextSelected,
                    ]}
                  >
                    {day.weekday}
                  </Text>

                  <Text
                    style={[
                      styles.dayNumber,

                      selected
                        && styles
                          .dayTextSelected,
                    ]}
                  >
                    {day.day}
                  </Text>

                  <View
                    style={[
                      styles.dayDot,

                      day.hasLog
                        && styles
                          .dayDotSaved,

                      selected
                        && day.hasLog
                        && styles
                          .dayDotSelected,
                    ]}
                  />
                </TouchableOpacity>
              );
            },
          )}
        </ScrollView>
      </SurfaceCard>
    );

  const renderSelectedLogCard =
    () => (
      <SurfaceCard
        style={
          styles.selectedLogCard
        }
      >
        <View
          style={
            styles.selectedLogHeader
          }
        >
          <View
            style={{ flex: 1 }}
          >
            <Text
              style={
                styles.logEyebrow
              }
            >
              Daily Oral Health Log
            </Text>

            <Text
              style={
                styles.selectedLogTitle
              }
            >
              {formatLongDate(
                selectedDateKey,
              )}
            </Text>
          </View>

          <View
            style={
              styles.logStateBadge
            }
          >
            <Text
              style={
                styles.logStateText
              }
            >
              {selectedLog
                ? 'Saved'
                : selectedDateIsFuture
                  ? 'Future'
                  : 'Not logged'}
            </Text>
          </View>
        </View>

        {selectedLog ? (
          <>
            <Text
              style={
                styles.cardBody
              }
            >
              Your oral health log
              for this date is saved.
              Review your selections
              below or edit them
              anytime.
            </Text>

            <View
              style={
                styles.selectedChipWrap
              }
            >
              {selectedItems
                .slice(0, 8)
                .map((item) => (
                  <View
                    key={`${item.groupId}-${item.id}`}
                    style={
                      styles.selectedChip
                    }
                  >
                    <Text
                      style={
                        styles
                          .selectedChipText
                      }
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
            </View>

            {selectedLog.notes ? (
              <View
                style={
                  styles.notesPreview
                }
              >
                <Text
                  style={
                    styles
                      .notesPreviewTitle
                  }
                >
                  Notes
                </Text>

                <Text
                  style={
                    styles
                      .notesPreviewBody
                  }
                >
                  {selectedLog.notes}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text
            style={
              styles.cardBody
            }
          >
            {selectedDateIsFuture
              ? 'Future dates cannot be logged yet.'
              : 'Nothing logged yet. Add a quick oral health check-in for this date.'}
          </Text>
        )}

        {!selectedDateIsFuture ? (
          <PrimaryButton
            label={
              selectedLog
                ? 'Edit Oral Health Log'
                : 'Log Oral Health'
            }
            icon={
              selectedLog
                ? 'create-outline'
                : 'add-circle-outline'
            }
            onPress={openLog}
            accessibilityLabel={
              selectedLog
                ? `Edit oral health log for ${formatLongDate(selectedDateKey)}`
                : `Log oral health for ${formatLongDate(selectedDateKey)}`
            }
            style={{
              marginTop: 10,
            }}
          />
        ) : null}
      </SurfaceCard>
    );

  const renderToday =
    () => (
      <>
        <SectionLabel
          eyebrow="Oral Health Management"
          title={
            selectedDateKey
              === todayKey
              ? "Today's Oral Health"
              : 'Selected Date'
          }
          actionLabel={
            selectedDateKey
              === todayKey
              ? undefined
              : 'Today'
          }
          onActionPress={
            goToToday
          }
        />

        {renderWeekStrip()}

        {renderSelectedLogCard()}

        <SectionLabel
          eyebrow="Recommended Visit Window"
          title="Your Current Visit Guidance"
        />

        <SurfaceCard
          style={styles.heroCard}
        >
          <View
            style={
              styles.heroTopRow
            }
          >
            <Text
              style={
                styles.heroEyebrow
              }
            >
              {
                preview.hero
                  .eyebrow
              }
            </Text>

            <View
              style={
                styles.systemBadge
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={
                  mobileTheme.colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.systemBadgeText
                }
              >
                System Recommendation
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.heroTitle
            }
          >
            {preview.hero.title}
          </Text>

          <Text
            style={
              styles.heroHeadline
            }
          >
            {
              preview.hero
                .headline
            }
          </Text>

          {preview.hero
            .hasClinicPlannedVisit ? (
            <View
              style={
                styles.clinicPlannedVisit
              }
            >
              <Ionicons
                name="calendar-outline"
                size={19}
                color={
                  mobileTheme.colors
                    .primaryDark
                }
              />

              <View
                style={
                  styles.clinicPlannedVisitCopy
                }
              >
                <Text
                  style={
                    styles.clinicPlannedVisitLabel
                  }
                >
                  Clinic-recorded next visit
                </Text>

                <Text
                  style={
                    styles.clinicPlannedVisitDate
                  }
                >
                  {preview.hero
                    .clinicPlannedDateLabel}
                </Text>

                {preview.hero
                  .clinicPlannedWindowLabel ? (
                  <Text
                    style={
                      styles.clinicPlannedVisitWindow
                    }
                  >
                    Planned window: {preview.hero
                      .clinicPlannedWindowLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <Text
            style={
              styles.heroBody
            }
          >
            {
              preview.hero
                .whyThisShowing
            }
          </Text>

          <View
            style={
              styles.statusPill
            }
          >
            <Ionicons
              name="sparkles-outline"
              size={14}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />

            <Text
              style={
                styles.statusPillText
              }
            >
              {
                preview.hero
                  .statusLabel
              }
            </Text>
          </View>

          <Text
            style={
              styles.helperText
            }
          >
            Recommendation based on
          </Text>

          <View
            style={
              styles.chipWrap
            }
          >
            {(
              preview.hero
                .sourceLabels
              || []
            ).map((label) => (
              <View
                key={label}
                style={
                  styles.infoChip
                }
              >
                <Text
                  style={
                    styles.infoChipText
                  }
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <Text
            style={
              styles.helperText
            }
          >
            {
              preview.hero
                .previewHint
            }
          </Text>

          <PrimaryButton
            label="Book Preventive Visit"
            icon="calendar-outline"
            onPress={() =>
              navigation.navigate(
                'AppointmentBooking',
              )
            }
            style={{
              marginBottom: 10,
            }}
          />

          <SecondaryButton
            label="Review Factors"
            icon="options-outline"
            onPress={() =>
              setFactorsVisible(
                true,
              )
            }
          />
        </SurfaceCard>

        <SectionLabel
          eyebrow="Oral Health Management"
          title="Current Factors"
          actionLabel="Open"
          onActionPress={() =>
            setFactorsVisible(true)
          }
        />

        <SurfaceCard
          style={styles.cardGap}
        >
          <Text
            style={styles.cardTitle}
          >
            {activeFactors.length
              ? `${activeFactors.length} active factor${activeFactors.length === 1 ? '' : 's'}`
              : 'No active factors'}
          </Text>

          <Text
            style={styles.cardBody}
          >
            Saved factors support
            Oral Health Management
            context without changing
            your clinical record.
          </Text>

          <View
            style={
              styles.chipWrap
            }
          >
            {activeFactors
              .map((factor) => (
                <View
                  key={factor.id}
                  style={
                    styles.infoChip
                  }
                >
                  <Text
                    style={
                      styles.infoChipText
                    }
                  >
                    {factor.label}
                  </Text>
                </View>
              ))}
          </View>
        </SurfaceCard>

        <SectionLabel
          eyebrow="Care Focus"
          title={
            preview.carePlan
              .title
          }
        />

        <SurfaceCard
          style={styles.cardGap}
        >
          <Text
            style={styles.cardBody}
          >
            {
              preview.carePlan
                .body
            }
          </Text>

          {preview.carePlan
            .checklist
            .map((item) => (
              <View
                key={item}
                style={
                  styles.checkRow
                }
              >
                <View
                  style={
                    styles.checkDot
                  }
                />

                <Text
                  style={
                    styles.checkText
                  }
                >
                  {item}
                </Text>
              </View>
            ))}
        </SurfaceCard>

        <TouchableOpacity
          style={
            styles.educationShortcut
          }
          activeOpacity={0.85}
          onPress={() =>
            setActiveTab(
              'education',
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Open Dental Health Education"
        >
          <View
            style={
              styles.educationIcon
            }
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={23}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />
          </View>

          <View
            style={{ flex: 1 }}
          >
            <Text
              style={
                styles
                  .educationShortcutTitle
              }
            >
              Dental Health Education
            </Text>

            <Text
              style={
                styles
                  .educationShortcutBody
              }
            >
              Browse the shared
              approved educational
              content from your
              patient account.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              mobileTheme.colors
                .primaryDark
            }
          />
        </TouchableOpacity>
      </>
    );

  const renderCalendar =
    () => (
      <>
        <SectionLabel
          eyebrow="History"
          title="Calendar"
          actionLabel={
            selectedDateKey
              === todayKey
              ? undefined
              : 'Today'
          }
          onActionPress={
            goToToday
          }
        />

        <SurfaceCard
          style={
            styles.calendarCard
          }
        >
          <Calendar
            key={calendarMonth}
            current={
              `${calendarMonth}-01`
            }
            maxDate={todayKey}
            firstDay={1}
            enableSwipeMonths
            markedDates={
              calendarMarks
            }
            onDayPress={(day) =>
              selectDate(
                day.dateString,
              )
            }
            onMonthChange={(
              month,
            ) => {
              setCalendarMonth(
                `${month.year}-${String(month.month).padStart(2, '0')}`,
              );
            }}
            theme={{
              calendarBackground:
                mobileTheme.colors
                  .surface,

              backgroundColor:
                mobileTheme.colors
                  .surface,

              textSectionTitleColor:
                mobileTheme.colors
                  .textSoft,

              todayTextColor:
                mobileTheme.colors
                  .secondaryDark,

              dayTextColor:
                mobileTheme.colors
                  .text,

              textDisabledColor:
                '#b7c8d3',

              arrowColor:
                mobileTheme.colors
                  .primaryDark,

              monthTextColor:
                mobileTheme.colors
                  .text,

              selectedDayBackgroundColor:
                mobileTheme.colors
                  .primaryDark,

              selectedDayTextColor:
                '#ffffff',

              dotColor:
                mobileTheme.colors
                  .secondary,

              selectedDotColor:
                '#ffffff',

              textMonthFontWeight:
                '800',

              textDayFontWeight:
                '600',

              textDayHeaderFontWeight:
                '700',
            }}
          />

          <View
            style={
              styles.calendarLegend
            }
          >
            <View
              style={
                styles.legendDot
              }
            />

            <Text
              style={
                styles.legendText
              }
            >
              Dot = saved Daily Oral
              Health Log
            </Text>
          </View>
        </SurfaceCard>

        <SectionLabel
          eyebrow="Selected Date"
          title="Daily Oral Health Log"
        />

        {renderSelectedLogCard()}

        <SectionLabel
          eyebrow="History"
          title="Recent Check-ins"
        />

        {logs.length ? (
          getRecentCheckIns(logs)
            .map((log) => {
              const count =
                (
                  log.symptoms
                    ?.length
                  || 0
                )
                + (
                  log.dailyCare
                    ?.length
                  || 0
                )
                + (
                  log.riskFactors
                    ?.length
                  || 0
                );

              return (
                <TouchableOpacity
                  key={
                    log.logDateKey
                  }
                  style={
                    styles.historyRow
                  }
                  activeOpacity={0.84}
                  onPress={() =>
                    selectDate(
                      log.logDateKey,
                    )
                  }
                >
                  <View
                    style={
                      styles.historyIcon
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={
                        mobileTheme
                          .colors
                          .primaryDark
                      }
                    />
                  </View>

                  <View
                    style={{ flex: 1 }}
                  >
                    <Text
                      style={
                        styles
                          .historyTitle
                      }
                    >
                      {formatLongDate(
                        log.logDateKey,
                      )}
                    </Text>

                    <Text
                      style={
                        styles
                          .historyMeta
                      }
                    >
                      {count}{' '}
                      recorded{' '}
                      {count === 1
                        ? 'item'
                        : 'items'}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      mobileTheme
                        .colors
                        .textSoft
                    }
                  />
                </TouchableOpacity>
              );
            })
        ) : (
          <SurfaceCard
            style={styles.cardGap}
          >
            <Text
              style={styles.cardTitle}
            >
              No check-ins yet
            </Text>

            <Text
              style={styles.cardBody}
            >
              Your saved daily check-ins will appear here.
            </Text>
          </SurfaceCard>
        )}
      </>
    );

  const renderTrends =
    () => (
      <>
        <SectionLabel
          eyebrow="Your History"
          title="Trends"
        />

        <SurfaceCard
          style={styles.cardGap}
        >
          <Text
            style={styles.cardTitle}
          >
            What You’ve Logged
          </Text>

          <Text
            style={styles.cardBody}
          >
            Trends use only the
            Daily Oral Health Logs
            already saved in your
            account. They are not an
            oral-health score and do
            not diagnose a
            condition.
          </Text>

          <View
            style={
              styles.trendSelector
            }
          >
            {TREND_WINDOWS.map(
              (option) => {
                const selected =
                  trendDays
                  === option.days;

                return (
                  <TouchableOpacity
                    key={
                      option.days
                    }
                    style={[
                      styles
                        .trendSelectorButton,

                      selected
                        && styles
                          .trendSelectorButtonActive,
                    ]}
                    onPress={() =>
                      setTrendDays(
                        option.days,
                      )
                    }
                    activeOpacity={0.82}
                  >
                    <Text
                      style={[
                        styles
                          .trendSelectorText,

                        selected
                          && styles
                            .trendSelectorTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          <Text
            style={
              styles.trendLogCount
            }
          >
            {trendLogs.length}{' '}
            logged{' '}
            {trendLogs.length === 1
              ? 'day'
              : 'days'}{' '}
            in this {trendDays}-day
            window
          </Text>
        </SurfaceCard>

        {!enoughTrendHistory ? (
          <SurfaceCard
            style={styles.cardGap}
          >
            <Ionicons
              name="analytics-outline"
              size={30}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />

            <Text
              style={[
                styles.cardTitle,
                {
                  marginTop: 10,
                },
              ]}
            >
              Not enough information yet
            </Text>

            <Text
              style={styles.cardBody}
            >
              Save at least 3 Daily
              Oral Health Logs in
              this {trendDays}-day
              window before
              frequency trends are
              summarized. You
              currently have{' '}
              {trendLogs.length}.
            </Text>
          </SurfaceCard>
        ) : (
          <>
            <TrendTimelineChart data={trendChartData} />
            <TrendFrequencyCard
              title="Care Habits"
              icon="checkmark-done-outline"
              rows={careTrends}
              totalLogs={
                trendLogs.length
              }
              emptyMessage="No care habits were recorded in this period."
            />

            <TrendFrequencyCard
              title="Symptoms"
              icon="pulse-outline"
              rows={
                symptomTrends
              }
              totalLogs={
                trendLogs.length
              }
              emptyMessage="No symptoms were recorded in this period."
            />

            <TrendFrequencyCard
              title="Risk Factors"
              icon="warning-outline"
              rows={riskTrends}
              totalLogs={
                trendLogs.length
              }
              emptyMessage="No risk factors were recorded in this period."
            />
          </>
        )}

        <SurfaceCard
          style={
            styles.disclaimerCard
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={19}
            color={
              mobileTheme.colors
                .primaryDark
            }
          />

          <Text
            style={
              styles.disclaimerText
            }
          >
            Trends describe saved
            observations and habits
            only. Persistent,
            worsening, severe, or
            concerning symptoms may
            be worth discussing with
            your dentist or clinic.
          </Text>
        </SurfaceCard>
      </>
    );

  const renderEducation =
    () => (
      <>
        <SectionLabel
          eyebrow="Dental Health Education"
          title="Learn About Your Oral Health"
        />

        <SurfaceCard
          style={styles.cardGap}
        >
          <View
            style={
              styles.educationIcon
            }
          >
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={24}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />
          </View>

          <Text
            style={styles.cardTitle}
          >
            Dental Health Education
          </Text>

          <Text
            style={styles.cardBody}
          >
            {educationArticles[0]
              ?.summary
              || 'Browse approved Dental Health Education from your patient account.'}
          </Text>

          <View
            style={
              styles.disclaimerInline
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />

            <Text
              style={
                styles.disclaimerText
              }
            >
              This information is
              educational and does
              not diagnose dental
              disease.
            </Text>
          </View>
        </SurfaceCard>

        <SectionLabel
          eyebrow="Recommended for You"
          title={
            contextualEducation.length
              ? 'Related to Your Recent Logs'
              : 'No Matching Topics Yet'
          }
        />

        {contextualEducation.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            style={
              styles.educationHorizontal
            }
            contentContainerStyle={{
              paddingHorizontal: 2,
            }}
          >
            {contextualEducation
              .map((article) => (
                <TouchableOpacity
                  key={article.id}
                  style={
                    styles
                      .contextArticle
                  }
                  activeOpacity={0.85}
                  onPress={() =>
                    setSelectedEducationArticle(
                      article,
                    )
                  }
                >
                  <Text
                    style={
                      styles
                        .articleCategory
                    }
                  >
                    {article.category
                      || 'Dental Health Education'}
                  </Text>

                  <Text
                    style={
                      styles
                        .contextArticleTitle
                    }
                  >
                    {article.title}
                  </Text>

                  <Text
                    style={
                      styles
                        .articleSummary
                    }
                    numberOfLines={4}
                  >
                    {article.summary}
                  </Text>

                  <Text
                    style={
                      styles.readLink
                    }
                  >
                    Read topic →
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        ) : (
          <SurfaceCard
            style={styles.cardGap}
          >
            <Text
              style={styles.cardTitle}
            >
              No contextual
              education yet
            </Text>

            <Text
              style={styles.cardBody}
            >
              Related topics will
              appear when your saved
              Oral Health Management
              information matches an
              approved educational
              topic.
            </Text>
          </SurfaceCard>
        )}

        <SectionLabel
          eyebrow="Education Library"
          title="Browse Dental Health Education"
        />

        {educationArticles.length ? (
          <>
            <View
              style={
                styles.searchBox
              }
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={
                  mobileTheme.colors
                    .textSoft
                }
              />

              <TextInput
                style={
                  styles.searchInput
                }
                value={
                  educationQuery
                }
                onChangeText={
                  setEducationQuery
                }
                placeholder="Search education topics"
                placeholderTextColor={
                  mobileTheme.colors
                    .textSoft
                }
                autoCorrect={false}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              style={
                styles.categoryScroll
              }
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip,

                  educationCategory
                    === 'all'
                    && styles
                      .categoryChipActive,
                ]}
                onPress={() =>
                  setEducationCategory(
                    'all',
                  )
                }
              >
                <Text
                  style={[
                    styles.categoryText,

                    educationCategory
                      === 'all'
                      && styles
                        .categoryTextActive,
                  ]}
                >
                  All Topics
                </Text>
              </TouchableOpacity>

              {educationCategories
                .map((category) => {
                  const selected =
                    educationCategory
                    === category.id;

                  return (
                    <TouchableOpacity
                      key={
                        category.id
                      }
                      style={[
                        styles
                          .categoryChip,

                        selected
                          && styles
                            .categoryChipActive,
                      ]}
                      onPress={() =>
                        setEducationCategory(
                          category.id,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles
                            .categoryText,

                          selected
                            && styles
                              .categoryTextActive,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            {filteredEducation.length ? (
              filteredEducation.map(
                (article) => (
                  <TouchableOpacity
                    key={article.id}
                    style={
                      styles.articleRow
                    }
                    activeOpacity={0.85}
                    onPress={() =>
                      setSelectedEducationArticle(
                        article,
                      )
                    }
                  >
                    <View
                      style={
                        styles.educationIcon
                      }
                    >
                      <MaterialCommunityIcons
                        name="book-open-outline"
                        size={20}
                        color={
                          mobileTheme
                            .colors
                            .primaryDark
                        }
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles
                            .articleTitle
                        }
                      >
                        {article.title}
                      </Text>

                      <Text
                        style={
                          styles
                            .articleSummary
                        }
                        numberOfLines={3}
                      >
                        {article.summary}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        mobileTheme
                          .colors
                          .textSoft
                      }
                    />
                  </TouchableOpacity>
                ),
              )
            ) : (
              <SurfaceCard
                style={
                  styles.cardGap
                }
              >
                <Text
                  style={
                    styles.cardTitle
                  }
                >
                  No matching topics
                </Text>

                <Text
                  style={
                    styles.cardBody
                  }
                >
                  Try another search
                  or category.
                </Text>
              </SurfaceCard>
            )}
          </>
        ) : (
          <SurfaceCard
            style={styles.cardGap}
          >
            <Text
              style={styles.cardTitle}
            >
              Education unavailable
            </Text>

            <Text
              style={styles.cardBody}
            >
              Dental Health
              Education could not be
              loaded right now.
            </Text>
          </SurfaceCard>
        )}
      </>
    );

  const renderActiveTab =
    () => {
      switch (activeTab) {
        case 'calendar':
          return renderCalendar();

        case 'trends':
          return renderTrends();

        case 'education':
          return renderEducation();

        case 'today':
        default:
          return renderToday();
      }
    };

  return (
    <Screen>
      <Header
        title="Oral Health Management"
        subtitle="Daily care, trends, and visit guidance"
      />

      <View
        style={styles.navWrap}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.navScroll
          }
        >
          {NAV_ITEMS.map(
            (item) => {
              const selected =
                activeTab
                === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.navButton,

                    selected
                      && styles
                        .navButtonActive,
                  ]}
                  activeOpacity={0.82}
                  onPress={() =>
                    setActiveTab(
                      item.id,
                    )
                  }
                  accessibilityRole="tab"
                  accessibilityState={{
                    selected,
                  }}
                >
                  <Text
                    style={[
                      styles.navText,

                      selected
                        && styles
                          .navTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <SurfaceCard
            style={styles.loadingCard}
          >
            <ActivityIndicator
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading saved Oral
              Health Management
              data...
            </Text>
          </SurfaceCard>
        ) : null}

        {loadError ? (
          <SurfaceCard
            style={styles.errorCard}
          >
            <Ionicons
              name="alert-circle-outline"
              size={25}
              color={
                mobileTheme.colors
                  .primaryDark
              }
            />

            <Text
              style={[
                styles.cardTitle,
                {
                  marginTop: 10,
                },
              ]}
            >
              Unable to load Oral
              Health Management
            </Text>

            <Text
              style={styles.cardBody}
            >
              {loadError}
            </Text>

            <SecondaryButton
              label="Try Again"
              icon="refresh-outline"
              onPress={
                fetchCareData
              }
            />
          </SurfaceCard>
        ) : null}

        {!loading
          ? renderActiveTab()
          : null}
      </ScrollView>

      <Modal
        visible={
          factorsVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setFactorsVisible(false)
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={styles.sheet}
          >
            <SheetHeader
              title="Oral Health Management"
              subtitle="Select the factors that currently apply to you."
              onClose={() =>
                setFactorsVisible(
                  false,
                )
              }
            />

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {factors.map(
                (item) => (
                  <FactorRow
                    key={item.id}
                    item={item}
                    onToggle={
                      toggleFactor
                    }
                  />
                ),
              )}
            </ScrollView>

            <PrimaryButton
              label={
                saving
                  ? 'Saving...'
                  : 'Save Factors'
              }
              disabled={saving}
              onPress={saveFactors}
              style={{
                marginTop: 15,
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={logVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (symptomDetailId) {
            setSymptomDetailId(null);
            return;
          }

          closeLog();
        }}
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.logSheet
            }
          >
            <SheetHeader
              title={
                selectedLog
                  ? 'Edit Oral Health Log'
                  : 'Log Oral Health'
              }
              subtitle={
                formatLongDate(
                  selectedDateKey,
                )
              }
              onClose={
                closeLog
              }
            />

            <View
              style={
                styles.logProgressArea
              }
            >
              <View
                style={
                  styles.logProgressTop
                }
              >
                <Text
                  style={
                    styles.logProgressLabel
                  }
                  accessibilityRole="header"
                  accessibilityLabel={
                    `Oral health log step ${logStep + 1} of 4`
                  }
                >
                  Step {logStep + 1} of 4
                </Text>

                <Text
                  style={
                    styles.logProgressTitle
                  }
                >
                  {logStep === 0
                    ? 'Symptoms'
                    : logStep === 1
                      ? 'Daily Care'
                      : logStep === 2
                        ? 'Other Factors'
                        : 'Review'}
                </Text>
              </View>

              <View
                style={
                  styles.logProgressTrack
                }
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 1,
                  max: 4,
                  now:
                    logStep + 1,
                  text:
                    `Step ${logStep + 1} of 4`,
                }}
              >
                <View
                  style={[
                    styles.logProgressFill,
                    {
                      width:
                        `${((logStep + 1) / 4) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.logStepScroll
              }
            >
              {logStep < 3
              && activeLogGroup ? (
                <>
                  <Text
                    style={
                      styles.logStepTitle
                    }
                  >
                    {logStep === 0
                      ? 'How are you feeling?'
                      : logStep === 1
                        ? 'What did you do for your oral care?'
                        : 'Any other factors today?'}
                  </Text>

                  <Text
                    style={
                      styles.logStepDescription
                    }
                  >
                    {logStep === 0
                      ? 'Select what applies. Choose No Symptoms when none of the listed symptoms apply.'
                      : logStep === 1
                        ? 'Select the care habits that apply to this date.'
                        : 'Select any relevant factors. Leave everything unselected if none apply.'}
                  </Text>

                  <View
                    style={
                      styles.logChipWrap
                    }
                  >
                    {activeLogGroup
                      .items
                      .map((item) => {
                        const supportsDetails =
                          activeLogGroup.id
                            === 'symptoms'
                          && Array.isArray(
                            item.detailFields,
                          )
                          && item
                            .detailFields
                            .length
                            > 0;

                        return (
                          <View
                            key={item.id}
                            style={
                              styles.logItemWrap
                            }
                          >
                            <TouchableOpacity
                              style={[
                                styles.logChip,
                                item.selected
                                  && styles
                                    .logChipActive,
                              ]}
                              activeOpacity={
                                0.84
                              }
                              onPress={() =>
                                toggleLogItem(
                                  activeLogGroup.id,
                                  item.id,
                                )
                              }
                              accessibilityRole="checkbox"
                              accessibilityState={{
                                checked:
                                  Boolean(
                                    item.selected,
                                  ),
                              }}
                              accessibilityLabel={
                                item.label
                              }
                            >
                              <Text
                                style={[
                                  styles.logChipText,
                                  item.selected
                                    && styles
                                      .logChipTextActive,
                                ]}
                              >
                                {item.label}
                              </Text>

                              {item.selected ? (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={17}
                                  color="#ffffff"
                                />
                              ) : null}
                            </TouchableOpacity>

                            {supportsDetails
                            && item
                              .selected ? (
                              <TouchableOpacity
                                style={
                                  styles.detailButton
                                }
                                activeOpacity={
                                  0.82
                                }
                                onPress={() =>
                                  setSymptomDetailId(
                                    item.id,
                                  )
                                }
                                accessibilityRole="button"
                                accessibilityLabel={
                                  `Add details for ${item.label}`
                                }
                              >
                                <Ionicons
                                  name="options-outline"
                                  size={13}
                                  color={
                                    mobileTheme
                                      .colors
                                      .primaryDark
                                  }
                                />

                                <Text
                                  style={
                                    styles
                                      .detailButtonText
                                  }
                                >
                                  {symptomDetails[
                                    item.id
                                  ]?.severity
                                  || symptomDetails[
                                    item.id
                                  ]?.duration
                                    ? 'Details saved'
                                    : 'Add details'}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
                  </View>

                  {logStep === 0 ? (
                    <View
                      style={
                        styles.disclaimerInline
                      }
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={17}
                        color={
                          mobileTheme
                            .colors
                            .primaryDark
                        }
                      />

                      <Text
                        style={
                          styles.disclaimerText
                        }
                      >
                        No Symptoms is exclusive. Severity and duration are optional descriptive details and do not create a diagnosis.
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text
                    style={
                      styles.logStepTitle
                    }
                  >
                    Review your log
                  </Text>

                  <Text
                    style={
                      styles.logStepDescription
                    }
                  >
                    Check what you selected before saving. You can go back to make changes.
                  </Text>

                  <View
                    style={
                      styles.logReviewCard
                    }
                  >
                    <Text
                      style={
                        styles.logReviewLabel
                      }
                    >
                      Symptoms
                    </Text>

                    <Text
                      style={
                        styles.logReviewValue
                      }
                    >
                      {selectedLogItemsByGroup
                        .symptoms
                        .length
                        ? selectedLogItemsByGroup
                          .symptoms
                          .map(
                            (item) =>
                              item.label,
                          )
                          .join(', ')
                        : 'None selected'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.logReviewCard
                    }
                  >
                    <Text
                      style={
                        styles.logReviewLabel
                      }
                    >
                      Daily Care
                    </Text>

                    <Text
                      style={
                        styles.logReviewValue
                      }
                    >
                      {selectedLogItemsByGroup
                        .dailyCare
                        .length
                        ? selectedLogItemsByGroup
                          .dailyCare
                          .map(
                            (item) =>
                              item.label,
                          )
                          .join(', ')
                        : 'None selected'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.logReviewCard
                    }
                  >
                    <Text
                      style={
                        styles.logReviewLabel
                      }
                    >
                      Other Factors
                    </Text>

                    <Text
                      style={
                        styles.logReviewValue
                      }
                    >
                      {selectedLogItemsByGroup
                        .riskFactors
                        .length
                        ? selectedLogItemsByGroup
                          .riskFactors
                          .map(
                            (item) =>
                              item.label,
                          )
                          .join(', ')
                        : 'None selected'}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.notesLabel
                    }
                  >
                    Notes
                  </Text>

                  <TextInput
                    style={
                      styles.notesInput
                    }
                    value={logNotes}
                    onChangeText={
                      setLogNotes
                    }
                    multiline
                    maxLength={500}
                    placeholder="Optional note for yourself before your next visit."
                    placeholderTextColor={
                      mobileTheme
                        .colors
                        .textSoft
                    }
                    accessibilityLabel="Optional oral health log notes"
                  />

                  {dailyLogIsEmpty ? (
                    <View
                      style={
                        styles.logValidationMessage
                      }
                      accessibilityRole="alert"
                    >
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color={
                          mobileTheme
                            .colors
                            .warning
                        }
                      />

                      <Text
                        style={
                          styles.logValidationText
                        }
                      >
                        Select at least one symptom, care item, risk factor, or note before saving
                      </Text>
                    </View>
                  ) : null}

                  <View
                    style={
                      styles.disclaimerInline
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={17}
                      color={
                        mobileTheme
                          .colors
                          .primaryDark
                      }
                    />

                    <Text
                      style={
                        styles.disclaimerText
                      }
                    >
                      This log records observations and habits. It does not diagnose a dental condition.
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View
              style={
                styles.logStepFooter
              }
            >
              {logStep > 0 ? (
                <SecondaryButton
                  label="Back"
                  icon="arrow-back-outline"
                  onPress={
                    goToPreviousLogStep
                  }
                  disabled={saving}
                  style={
                    styles.logStepBackButton
                  }
                />
              ) : null}

              <View
                style={
                  styles.logStepPrimary
                }
              >
                {logStep < 3 ? (
                  <PrimaryButton
                    label="Next"
                    icon="arrow-forward-outline"
                    onPress={
                      goToNextLogStep
                    }
                    disabled={saving}
                  />
                ) : (
                  <PrimaryButton
                    label={
                      saving
                        ? 'Saving...'
                        : selectedLog
                          ? 'Update Oral Health Log'
                          : 'Save Oral Health Log'
                    }
                    icon="checkmark-circle-outline"
                    disabled={
                      saving
                      || selectedDateIsFuture
                    }
                    onPress={
                      saveDailyLog
                    }
                  />
                )}
              </View>
            </View>
          </View>

          {Boolean(
            symptomDetailId,
          ) ? (
            <View
              style={
                styles.detailModalOverlay
              }
            >
          <View
            style={
              styles.detailSheet
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <SheetHeader
              title={
                activeSymptom?.label
                || 'Symptom Details'
              }
              subtitle="Optional descriptive details for this symptom."
              onClose={() =>
                setSymptomDetailId(
                  null,
                )
              }
            />

            {activeSymptom
              ?.detailFields
              ?.includes(
                'severity',
              ) ? (
              <View
                style={
                  styles.detailGroup
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Severity
                </Text>

                <Text
                  style={
                    styles.detailHint
                  }
                >
                  Choose how you
                  would describe the
                  symptom.
                </Text>

                <View
                  style={
                    styles.severityRow
                  }
                >
                  {SEVERITY_OPTIONS
                    .map((option) => {
                      const selected =
                        symptomDetails[
                          symptomDetailId
                        ]?.severity
                        === option;

                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles
                              .severityChip,

                            selected
                              && styles
                                .severityChipActive,
                          ]}
                          activeOpacity={0.82}
                          onPress={() =>
                            updateSymptomDetail(
                              'severity',
                              option,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles
                                .severityText,

                              selected
                                && styles
                                  .severityTextActive,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </View>
            ) : null}

            {activeSymptom
              ?.detailFields
              ?.includes(
                'duration',
              ) ? (
              <View
                style={
                  styles.detailGroup
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Duration
                </Text>

                <Text
                  style={
                    styles.detailHint
                  }
                >
                  Use a short factual
                  description such as
                  “2 days” or “since
                  yesterday”.
                </Text>

                <TextInput
                  style={
                    styles.durationInput
                  }
                  value={
                    symptomDetails[
                      symptomDetailId
                    ]?.duration
                    || ''
                  }
                  onChangeText={(
                    value,
                  ) =>
                    updateSymptomDetail(
                      'duration',
                      value,
                    )
                  }
                  maxLength={80}
                  placeholder="e.g. 2 days"
                  placeholderTextColor={
                    mobileTheme.colors
                      .textSoft
                  }
                />
              </View>
            ) : null}

            <View
              style={
                styles.disclaimerInline
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={
                  mobileTheme.colors
                    .primaryDark
                }
              />

              <Text
                style={
                  styles.disclaimerText
                }
              >
                Severity and duration
                are descriptive,
                patient-entered
                details. They do not
                create a diagnosis.
              </Text>
            </View>

            <PrimaryButton
              label="Done"
              onPress={() =>
                setSymptomDetailId(
                  null,
                )
              }
              style={{
                marginTop: 16,
              }}
            />
          </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={
          Boolean(
            selectedEducationArticle,
          )
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setSelectedEducationArticle(
            null,
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.educationSheet
            }
          >
            <SheetHeader
              title="Dental Health Education"
              subtitle={
                selectedEducationArticle
                  ?.category
                || 'Educational oral-health information'
              }
              onClose={() =>
                setSelectedEducationArticle(
                  null,
                )
              }
            />

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {selectedEducationArticle ? (
                <>
                  <Text
                    style={
                      styles.articleCategory
                    }
                  >
                    {
                      selectedEducationArticle
                        .category
                      || 'Dental Health Education'
                    }
                  </Text>

                  <Text
                    style={
                      styles
                        .educationSheetTitle
                    }
                  >
                    {
                      selectedEducationArticle
                        .title
                    }
                  </Text>

                  <Text
                    style={
                      styles
                        .educationSheetSummary
                    }
                  >
                    {
                      selectedEducationArticle
                        .summary
                    }
                  </Text>

                  <View
                    style={
                      styles.divider
                    }
                  />

                  <Text
                    style={
                      styles
                        .educationSheetBody
                    }
                  >
                    {
                      selectedEducationArticle
                        .body
                      || selectedEducationArticle
                        .summary
                    }
                  </Text>

                  {selectedEducationArticle
                    .action ? (
                    <View
                      style={
                        styles.actionCard
                      }
                    >
                      <Text
                        style={
                          styles
                            .actionTitle
                        }
                      >
                        What you can do
                      </Text>

                      <Text
                        style={
                          styles
                            .actionBody
                        }
                      >
                        {
                          selectedEducationArticle
                            .action
                        }
                      </Text>
                    </View>
                  ) : null}

                  <View
                    style={
                      styles.disclaimerInline
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={
                        mobileTheme
                          .colors
                          .primaryDark
                      }
                    />

                    <Text
                      style={
                        styles
                          .disclaimerText
                      }
                    >
                      Dental Health
                      Education is
                      informational
                      and
                      non-diagnostic.
                    </Text>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={noticeModal.visible}
        title={noticeModal.title}
        message={noticeModal.message}
        type={noticeModal.type}
        onClose={closeNoticeModal}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 54,
  },

  navWrap: {
    backgroundColor:
      mobileTheme.colors
        .background,

    borderBottomWidth: 1,

    borderBottomColor:
      mobileTheme.colors.border,
  },

  navScroll: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  navButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginRight: 8,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  navButtonActive: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  navText: {
    fontSize: 12,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .textMuted,
  },

  navTextActive: {
    color: '#ffffff',
  },

  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 94,
    marginBottom: 18,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,

    color:
      mobileTheme.colors
        .textMuted,
  },

  errorCard: {
    marginBottom: 18,
  },

  heroCard: {
    marginBottom: 22,
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',

    justifyContent:
      'space-between',

    marginBottom: 10,
  },

  heroEyebrow: {
    flex: 1,
    paddingRight: 10,

    fontSize: 11,
    lineHeight: 16,

    fontWeight: '800',

    textTransform:
      'uppercase',

    color:
      mobileTheme.colors
        .secondaryDark,
  },

  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 10,
    paddingVertical: 7,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  systemBadgeText: {
    marginLeft: 5,
    fontSize: 10,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  heroTitle: {
    fontSize: 25,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 8,
  },

  heroHeadline: {
    fontSize: 17,
    lineHeight: 24,

    fontWeight: '700',

    color:
      mobileTheme.colors
        .primaryDark,

    marginBottom: 10,
  },

  heroBody: {
    fontSize: 14,
    lineHeight: 21,

    color:
      mobileTheme.colors
        .textMuted,

    marginBottom: 14,
  },

  clinicPlannedVisit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    marginBottom: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors
        .border,
    backgroundColor:
      mobileTheme.colors
        .surfaceAlt,
  },

  clinicPlannedVisitCopy: {
    flex: 1,
  },

  clinicPlannedVisitLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    color:
      mobileTheme.colors
        .textSoft,
  },

  clinicPlannedVisitDate: {
    marginTop: 3,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color:
      mobileTheme.colors
        .primaryDark,
  },

  clinicPlannedVisitWindow: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color:
      mobileTheme.colors
        .textMuted,
  },

  statusPill: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,
    paddingVertical: 8,

    marginBottom: 14,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .secondarySoft,
  },

  statusPillText: {
    marginLeft: 6,

    fontSize: 12,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textSoft,

    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 16,
    lineHeight: 22,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 7,
  },

  cardBody: {
    fontSize: 13,
    lineHeight: 20,

    color:
      mobileTheme.colors
        .textMuted,

    marginBottom: 10,
  },

  cardGap: {
    marginBottom: 20,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },

  infoChip: {
    marginRight: 8,
    marginBottom: 8,

    paddingHorizontal: 11,
    paddingVertical: 8,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors
        .surfaceAlt,
  },

  infoChipText: {
    fontSize: 11,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  weekCard: {
    marginBottom: 14,
  },

  weekTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  weekTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  weekTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  weekSubtitle: {
    marginTop: 4,
    textAlign: 'center',

    fontSize: 11,
    lineHeight: 16,

    color:
      mobileTheme.colors
        .textSoft,
  },

  weekArrow: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 19,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors
        .surfaceAlt,
  },

  weekScroll: {
    paddingHorizontal: 1,
  },

  dayCard: {
    width: 55,
    minHeight: 78,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 8,

    borderRadius: 18,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  dayCardSelected: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  dayCardDisabled: {
    opacity: 0.35,
  },

  dayWeekday: {
    fontSize: 10,
    fontWeight: '800',

    textTransform:
      'uppercase',

    color:
      mobileTheme.colors
        .textSoft,
  },

  dayNumber: {
    marginTop: 5,

    fontSize: 20,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  dayTextSelected: {
    color: '#ffffff',
  },

  dayDot: {
    width: 6,
    height: 6,

    marginTop: 6,

    borderRadius: 3,

    backgroundColor:
      'transparent',
  },

  dayDotSaved: {
    backgroundColor:
      mobileTheme.colors
        .secondary,
  },

  dayDotSelected: {
    backgroundColor:
      '#ffffff',
  },

  selectedLogCard: {
    marginBottom: 22,
  },

  selectedLogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  logEyebrow: {
    fontSize: 10,
    lineHeight: 15,

    fontWeight: '800',

    textTransform:
      'uppercase',

    color:
      mobileTheme.colors
        .secondaryDark,

    marginBottom: 4,
  },

  selectedLogTitle: {
    paddingRight: 8,

    fontSize: 17,
    lineHeight: 23,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  logStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .secondarySoft,
  },

  logStateText: {
    fontSize: 10,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  selectedChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 7,
  },

  selectedChip: {
    marginRight: 7,
    marginBottom: 7,

    paddingHorizontal: 11,
    paddingVertical: 7,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .secondarySoft,
  },

  selectedChipText: {
    fontSize: 11,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  notesPreview: {
    padding: 12,
    marginTop: 4,

    borderRadius:
      mobileTheme.radii.md,

    backgroundColor:
      mobileTheme.colors
        .backgroundMuted,
  },

  notesPreviewTitle: {
    fontSize: 11,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 4,
  },

  notesPreviewBody: {
    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textMuted,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 9,
  },

  checkDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    marginTop: 7,
    marginRight: 10,

    backgroundColor:
      mobileTheme.colors
        .secondary,
  },

  checkText: {
    flex: 1,

    fontSize: 13,
    lineHeight: 20,

    color:
      mobileTheme.colors
        .textMuted,
  },

  educationShortcut: {
    minHeight: 110,

    flexDirection: 'row',
    alignItems: 'center',

    padding: 16,
    marginBottom: 20,

    borderRadius:
      mobileTheme.radii.lg,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,

    ...mobileTheme.shadows.soft,
  },

  educationIcon: {
    width: 44,
    height: 44,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 22,

    marginRight: 12,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  educationShortcutTitle: {
    fontSize: 15,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 5,
  },

  educationShortcutBody: {
    paddingRight: 8,

    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textMuted,
  },

  calendarCard: {
    padding: 10,
    marginBottom: 20,
  },

  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 8,
    paddingTop: 10,

    borderTopWidth: 1,

    borderTopColor:
      mobileTheme.colors.border,
  },

  legendDot: {
    width: 8,
    height: 8,

    marginRight: 8,

    borderRadius: 4,

    backgroundColor:
      mobileTheme.colors
        .secondary,
  },

  legendText: {
    fontSize: 11,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .textMuted,
  },

  historyRow: {
    minHeight: 76,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
    paddingVertical: 11,

    marginBottom: 10,

    borderRadius:
      mobileTheme.radii.md,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,

    ...mobileTheme.shadows.soft,
  },

  historyIcon: {
    width: 40,
    height: 40,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 20,

    marginRight: 12,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  historyTitle: {
    fontSize: 13,
    lineHeight: 19,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  historyMeta: {
    marginTop: 4,

    fontSize: 11,

    color:
      mobileTheme.colors
        .textSoft,
  },

  trendSelector: {
    flexDirection: 'row',
    marginTop: 12,
  },

  trendSelectorButton: {
    flex: 1,

    minHeight: 43,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 8,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  trendSelectorButtonActive: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  trendSelectorText: {
    fontSize: 12,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .textMuted,
  },

  trendSelectorTextActive: {
    color: '#ffffff',
  },

  trendLogCount: {
    marginTop: 14,

    fontSize: 11,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .textSoft,
  },

  trendCard: {
    marginBottom: 14,
  },

  trendCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 10,
  },

  trendIcon: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,

    borderRadius: 19,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  trendTitle: {
    fontSize: 16,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  trendRow: {
    minHeight: 58,

    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 10,

    borderTopWidth: 1,

    borderTopColor:
      mobileTheme.colors.border,
  },

  trendRowCopy: {
    flex: 1,
    paddingRight: 10,
  },

  trendRowTitle: {
    fontSize: 13,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  trendRowMeta: {
    marginTop: 3,

    fontSize: 11,

    color:
      mobileTheme.colors
        .textSoft,
  },

  trendPercent: {
    minWidth: 54,

    alignItems: 'center',

    paddingHorizontal: 9,
    paddingVertical: 7,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .secondarySoft,
  },

  trendPercentText: {
    fontSize: 11,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  trendBarTrack: {
    width: 92,
    height: 12,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: mobileTheme.colors.primarySoft,
  },

  trendBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: mobileTheme.colors.primaryDark,
  },

  timelineChart: { alignItems: 'flex-end', minHeight: 132, paddingTop: 18, paddingRight: 12 },
  timelineColumn: { width: 48, alignItems: 'center', marginRight: 6 },
  timelineBarArea: { height: 86, justifyContent: 'flex-end' },
  timelineBar: { width: 22, borderRadius: 6, backgroundColor: mobileTheme.colors.primaryDark },
  timelineValue: { marginTop: 4, color: mobileTheme.colors.text, fontSize: 11, fontWeight: '800' },
  timelineDate: { marginTop: 2, color: mobileTheme.colors.textSoft, fontSize: 9 },

  emptyBody: {
    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textSoft,
  },

  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  disclaimerInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    padding: 12,
    marginTop: 10,

    borderRadius:
      mobileTheme.radii.md,

    backgroundColor:
      mobileTheme.colors
        .backgroundMuted,
  },

  disclaimerText: {
    flex: 1,

    marginLeft: 9,

    fontSize: 11,
    lineHeight: 17,

    color:
      mobileTheme.colors
        .textMuted,
  },

  educationHorizontal: {
    marginBottom: 20,
  },

  contextArticle: {
    width: 260,
    minHeight: 205,

    padding: 16,
    marginRight: 12,

    borderRadius:
      mobileTheme.radii.lg,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,

    ...mobileTheme.shadows.soft,
  },

  articleCategory: {
    fontSize: 10,
    lineHeight: 15,

    fontWeight: '800',

    textTransform:
      'uppercase',

    color:
      mobileTheme.colors
        .secondaryDark,

    marginBottom: 6,
  },

  contextArticleTitle: {
    fontSize: 16,
    lineHeight: 22,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 8,
  },

  articleSummary: {
    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textMuted,
  },

  readLink: {
    marginTop: 12,

    fontSize: 12,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  searchBox: {
    minHeight: 50,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
    marginBottom: 12,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  searchInput: {
    flex: 1,

    paddingHorizontal: 10,

    fontSize: 13,

    color:
      mobileTheme.colors.text,
  },

  categoryScroll: {
    marginBottom: 15,
  },

  categoryChip: {
    minHeight: 41,

    justifyContent: 'center',

    paddingHorizontal: 14,

    marginRight: 8,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  categoryChipActive: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  categoryText: {
    fontSize: 11,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .textMuted,
  },

  categoryTextActive: {
    color: '#ffffff',
  },

  articleRow: {
    minHeight: 110,

    flexDirection: 'row',
    alignItems: 'center',

    padding: 14,
    marginBottom: 10,

    borderRadius:
      mobileTheme.radii.md,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,

    ...mobileTheme.shadows.soft,
  },

  articleTitle: {
    paddingRight: 8,

    fontSize: 14,
    lineHeight: 20,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 5,
  },

  modalOverlay: {
    flex: 1,

    justifyContent: 'flex-end',

    backgroundColor:
      'rgba(1, 59, 99, 0.35)',
  },

  detailModalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    elevation: 20,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(1, 59, 99, 0.45)',
  },

  sheet: {
    maxHeight: '82%',

    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  logSheet: {
    maxHeight: '94%',
    minHeight: '64%',

    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  detailSheet: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  educationSheet: {
    maxHeight: '88%',

    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  sheetHandle: {
    width: 42,
    height: 5,

    alignSelf: 'center',

    marginBottom: 12,

    borderRadius: 3,

    backgroundColor:
      mobileTheme.colors
        .borderStrong,
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    marginBottom: 18,
  },

  sheetHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  sheetSubtitle: {
    marginTop: 5,

    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textMuted,
  },

  sheetCloseButton: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 19,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors
        .surfaceAlt,
  },

  factorRow: {
    minHeight: 58,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
    paddingVertical: 10,

    marginBottom: 9,

    borderRadius:
      mobileTheme.radii.md,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  factorRowActive: {
    borderColor:
      mobileTheme.colors
        .secondary,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  factorLabel: {
    flex: 1,

    paddingRight: 12,

    fontSize: 14,
    fontWeight: '700',

    color:
      mobileTheme.colors.text,
  },

  factorLabelActive: {
    color:
      mobileTheme.colors
        .primaryDark,
  },

  factorToggle: {
    width: 26,
    height: 26,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 13,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors
        .borderStrong,

    backgroundColor: '#ffffff',
  },

  factorToggleActive: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  editState: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    padding: 12,
    marginBottom: 16,

    borderRadius:
      mobileTheme.radii.md,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  editStateText: {
    flex: 1,

    marginLeft: 9,

    fontSize: 12,
    lineHeight: 18,

    color:
      mobileTheme.colors
        .textMuted,
  },

  logGroup: {
    marginBottom: 18,
  },

  logGroupTitle: {
    fontSize: 15,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 6,
  },

  logGroupHint: {
    fontSize: 11,
    lineHeight: 17,

    color:
      mobileTheme.colors
        .textSoft,

    marginBottom: 9,
  },

  logChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  logItemWrap: {
    marginRight: 8,
    marginBottom: 9,
  },

  logChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor: '#ffffff',
  },

  logChipActive: {
    borderColor:
      mobileTheme.colors
        .secondary,

    backgroundColor:
      mobileTheme.colors
        .secondarySoft,
  },

  logChipText: {
    fontSize: 12,
    fontWeight: '700',

    color:
      mobileTheme.colors
        .textMuted,
  },

  logChipTextActive: {
    color:
      mobileTheme.colors
        .primaryDark,
  },

  detailButton: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 5,

    paddingHorizontal: 9,
    paddingVertical: 6,

    borderRadius:
      mobileTheme.radii.pill,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  detailButtonText: {
    marginLeft: 4,

    fontSize: 10,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .primaryDark,
  },

  notesLabel: {
    fontSize: 13,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 8,
  },

  notesInput: {
    minHeight: 96,

    paddingHorizontal: 14,
    paddingVertical: 12,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    borderRadius: 18,

    color:
      mobileTheme.colors.text,

    backgroundColor: '#ffffff',

    textAlignVertical: 'top',

    fontSize: 13,
    lineHeight: 19,
  },

  detailGroup: {
    marginBottom: 18,
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,
  },

  detailHint: {
    marginTop: 4,
    marginBottom: 10,

    fontSize: 11,
    lineHeight: 17,

    color:
      mobileTheme.colors
        .textSoft,
  },

  severityRow: {
    flexDirection: 'row',
  },

  severityChip: {
    flex: 1,

    minHeight: 42,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 7,

    borderRadius:
      mobileTheme.radii.pill,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  severityChipActive: {
    borderColor:
      mobileTheme.colors
        .primaryDark,

    backgroundColor:
      mobileTheme.colors
        .primaryDark,
  },

  severityText: {
    fontSize: 11,
    fontWeight: '800',

    color:
      mobileTheme.colors
        .textMuted,
  },

  severityTextActive: {
    color: '#ffffff',
  },

  durationInput: {
    minHeight: 48,

    paddingHorizontal: 14,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors.border,

    borderRadius:
      mobileTheme.radii.md,

    fontSize: 13,

    color:
      mobileTheme.colors.text,

    backgroundColor:
      mobileTheme.colors.surface,
  },

  educationSheetTitle: {
    fontSize: 23,
    lineHeight: 30,

    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 11,
  },

  educationSheetSummary: {
    fontSize: 14,
    lineHeight: 22,

    fontWeight: '600',

    color:
      mobileTheme.colors
        .textMuted,
  },

  divider: {
    height: 1,

    marginVertical: 19,

    backgroundColor:
      mobileTheme.colors.border,
  },

  educationSheetBody: {
    fontSize: 14,
    lineHeight: 23,

    color:
      mobileTheme.colors.text,
  },

  actionCard: {
    padding: 15,
    marginTop: 19,

    borderRadius:
      mobileTheme.radii.md,

    borderWidth: 1,

    borderColor:
      mobileTheme.colors
        .borderStrong,

    backgroundColor:
      mobileTheme.colors
        .primarySoft,
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: '800',

    color:
      mobileTheme.colors.text,

    marginBottom: 7,
  },

  actionBody: {
    fontSize: 13,
    lineHeight: 20,

    color:
      mobileTheme.colors
        .textMuted,
  },

    logProgressArea: {
    marginBottom: 14,
  },

  logProgressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginBottom: 8,
  },

  logProgressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color:
      mobileTheme.colors
        .textMuted,
  },

  logProgressTitle: {
    fontSize: 13,
    fontWeight: '800',
    color:
      mobileTheme.colors
        .primaryDark,
  },

  logProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor:
      mobileTheme.colors
        .border,
  },

  logProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor:
      mobileTheme.colors
        .primary,
  },

  logStepScroll: {
    paddingBottom: 16,
  },

  logStepTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color:
      mobileTheme.colors
        .text,
    marginBottom: 7,
  },

  logStepDescription: {
    fontSize: 14,
    lineHeight: 21,
    color:
      mobileTheme.colors
        .textMuted,
    marginBottom: 18,
  },

  logStepFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor:
      mobileTheme.colors
        .border,
  },

  logStepBackButton: {
    flex: 0.8,
  },

  logStepPrimary: {
    flex: 1.2,
  },

  logReviewCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors
        .border,
    backgroundColor:
      mobileTheme.colors
        .surfaceSoft
      || mobileTheme.colors
        .surface,
  },

  logReviewLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform:
      'uppercase',
    letterSpacing: 0.4,
    color:
      mobileTheme.colors
        .primaryDark,
    marginBottom: 5,
  },

  logReviewValue: {
    fontSize: 14,
    lineHeight: 21,
    color:
      mobileTheme.colors
        .text,
  },

  logValidationMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      mobileTheme.colors
        .warning,
    backgroundColor:
      mobileTheme.colors
        .warningSoft,
  },

  logValidationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color:
      mobileTheme.colors
        .text,
  },
});
