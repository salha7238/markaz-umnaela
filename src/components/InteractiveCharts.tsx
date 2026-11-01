import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { CH_TITLES } from '../data/constants';

// Distinct, accessible educational color palette
export const CHART_COLORS = [
  '#0E5E5A', // Ministry Deep Teal
  '#05ABA3', // Vibrant Cyan / Teal
  '#1D4ED8', // Royal Blue
  '#EA580C', // Amber Orange
  '#7C3AED', // Purple
  '#16A34A', // Emerald Green
  '#D97706', // Gold / Ochre
  '#E11D48', // Crimson Rose
  '#475569'  // Slate
];

export interface ChartDataSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface ChartRawItem {
  labels: string[];
  series: ChartDataSeries[];
  cnt: string;
}

// Convert raw series data into Bar-friendly Recharts objects
export function transformToBarData(raw: ChartRawItem) {
  if (!raw || !raw.labels) return [];
  return raw.labels.map((label, idx) => {
    const item: Record<string, any> = { name: label };
    raw.series.forEach((s) => {
      item[s.name] = s.values[idx] || 0;
    });
    return item;
  });
}

// Convert raw series data into Pie-friendly Recharts objects
export function transformToPieData(raw: ChartRawItem) {
  if (!raw || !raw.labels) return [];
  // If single series (e.g. fields, programs by stage, beneficiaries, mode)
  if (raw.series.length === 1) {
    const s = raw.series[0];
    return raw.labels
      .map((label, idx) => ({
        name: label,
        value: s.values[idx] || 0
      }))
      .filter((d) => d.value > 0);
  }
  // If multiple series (e.g. compare Series A total vs Series B total)
  return raw.series.map((s) => ({
    name: s.name,
    value: s.values.reduce((sum, v) => sum + (v || 0), 0)
  })).filter((d) => d.value > 0);
}

// Custom Arabic Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      dir="rtl"
      style={{
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1.5px solid #0E5E5A',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        fontSize: '12px',
        fontFamily: 'Cairo, Tahoma, sans-serif',
        minWidth: '130px',
        textAlign: 'right',
        zIndex: 1000
      }}
    >
      {label && (
        <div style={{ fontWeight: 700, color: '#0E5E5A', marginBottom: '4px', borderBottom: '1px solid #f0f0f0', paddingBottom: '3px' }}>
          {label}
        </div>
      )}
      {payload.map((entry: any, index: number) => {
        const val = entry.value != null ? Number(entry.value).toLocaleString('ar-SA') : '0';
        return (
          <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '2px 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#4b5563' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color || entry.fill }} />
              {entry.name}:
            </span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
};

export interface InteractiveChartProps {
  chartIndex: number;
  data: ChartRawItem | null;
  title?: string;
  isModal?: boolean;
  onEnlarge?: (idx: number) => void;
  defaultType?: 'bar' | 'pie';
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  chartIndex,
  data,
  title,
  isModal = false,
  onEnlarge,
  defaultType
}) => {
  // Determine smart default type: Chart 4 (حضوري وعن بعد) is great as Pie/Donut; others default to Bar
  const initialType: 'bar' | 'pie' = defaultType || (chartIndex === 4 ? 'pie' : 'bar');
  const [chartType, setChartType] = useState<'bar' | 'pie'>(initialType);

  if (!data) {
    return (
      <div
        dir="rtl"
        style={{
          height: isModal ? '320px' : '220px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1.5px dashed #cbd5e1',
          color: '#64748b',
          fontSize: '13.5px',
          fontFamily: 'Cairo, sans-serif',
          gap: '8px',
          padding: '16px',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: '24px' }}>📊</span>
        <span>لا توجد بيانات كافية لعرض هذا الرسم البياني حاليًا.</span>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
          أضف بيانات البرامج أو المستفيدين أو أولمبياد نسمو لتوليد الرسم البياني تلقائيًا.
        </span>
      </div>
    );
  }

  const barData = transformToBarData(data);
  const pieData = transformToPieData(data);

  // Compute total for percentage calculations
  const totalValue = pieData.reduce((acc, curr) => acc + (curr.value || 0), 0);

  const displayTitle = title || CH_TITLES[chartIndex] || `رسم بياني ${chartIndex + 1}`;

  return (
    <div
      className={`recharts-box ${isModal ? 'is-modal' : ''}`}
      dir="rtl"
      style={{
        position: 'relative',
        width: '100%',
        background: '#ffffff',
        borderRadius: isModal ? '12px' : '8px',
        border: isModal ? 'none' : '1px solid #e2e8f0',
        padding: isModal ? '14px 16px' : '8px 10px',
        boxSizing: 'border-box',
        fontFamily: 'Cairo, Tahoma, sans-serif'
      }}
    >
      {/* Top Header Controls (Switch Type & Enlarge Button) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '6px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: isModal ? '15px' : '12px', fontWeight: 700, color: '#0E5E5A' }}>
            {displayTitle}
          </span>
          {data.cnt && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#05ABA3',
                background: '#f0fdfa',
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {data.cnt.trim()}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Chart Type Toggle Button */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              borderRadius: '6px',
              padding: '2px'
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setChartType('bar');
              }}
              style={{
                background: chartType === 'bar' ? '#0E5E5A' : 'transparent',
                color: chartType === 'bar' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="عرض كأعمدة بيانية"
            >
              📊 أعمدة
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setChartType('pie');
              }}
              style={{
                background: chartType === 'pie' ? '#0E5E5A' : 'transparent',
                color: chartType === 'pie' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="عرض كرسم دائري"
            >
              🥧 دائري
            </button>
          </div>

          {/* Enlarge Button (only when not inside modal) */}
          {!isModal && onEnlarge && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnlarge(chartIndex);
              }}
              style={{
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                color: '#0d9488',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="انقر لتكبير الرسم البياني وعرض التفاصيل"
            >
              🔍 تكبير
            </button>
          )}
        </div>
      </div>

      {/* Main Chart Graphic Area */}
      <div
        style={{
          width: '100%',
          height: isModal ? '340px' : '220px',
          cursor: !isModal && onEnlarge ? 'pointer' : 'default',
          position: 'relative'
        }}
        onClick={() => {
          if (!isModal && onEnlarge) onEnlarge(chartIndex);
        }}
        title={!isModal && onEnlarge ? 'انقر لتكبير الرسم البياني' : ''}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart
              data={barData}
              margin={{ top: 12, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isModal ? 12 : 10.5, fill: '#334155', fontFamily: 'Cairo, sans-serif' }}
                interval={0}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: isModal ? 12 : 10, fill: '#64748b' }}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {data.series.length > 1 && (
                <Legend
                  wrapperStyle={{
                    paddingTop: '6px',
                    fontSize: isModal ? '12px' : '11px',
                    fontFamily: 'Cairo, sans-serif'
                  }}
                />
              )}
              {data.series.map((s, sIdx) => {
                const color = s.color || CHART_COLORS[sIdx % CHART_COLORS.length];
                return (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={isModal ? 48 : 34}
                  />
                );
              })}
            </BarChart>
          ) : (
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: isModal ? '12px' : '10.5px',
                  fontFamily: 'Cairo, sans-serif'
                }}
              />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartIndex === 4 ? (isModal ? 65 : 40) : 0}
                outerRadius={isModal ? 120 : 75}
                paddingAngle={pieData.length > 1 ? 2 : 0}
                label={({ name, percent }: any) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* When inside Modal: Detailed Numerical Breakdown Table */}
      {isModal && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E5E5A', marginBottom: '8px' }}>
            📋 تفاصيل وبيانات الرسم الإحصائي:
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              dir="rtl"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                textAlign: 'right'
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', color: '#0E5E5A', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 10px' }}>م</th>
                  <th style={{ padding: '7px 10px' }}>البيان / التصنيف</th>
                  {data.series.map((s) => (
                    <th key={s.name} style={{ padding: '7px 10px' }}>
                      {s.name}
                    </th>
                  ))}
                  <th style={{ padding: '7px 10px', textAlign: 'center' }}>النسبة من الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {data.labels.map((lbl, idx) => {
                  const firstVal = data.series[0]?.values[idx] || 0;
                  const pct = totalValue > 0 ? ((firstVal / totalValue) * 100).toFixed(1) : '0';
                  return (
                    <tr
                      key={lbl}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd'
                      }}
                    >
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1e293b' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: CHART_COLORS[idx % CHART_COLORS.length],
                            marginLeft: '6px'
                          }}
                        />
                        {lbl}
                      </td>
                      {data.series.map((s) => (
                        <td key={s.name} style={{ padding: '7px 10px', fontWeight: 700, color: '#0E5E5A' }}>
                          {(s.values[idx] || 0).toLocaleString('ar-SA')}
                        </td>
                      ))}
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <div
                            style={{
                              width: '60px',
                              height: '6px',
                              background: '#e2e8f0',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Number(pct))}%`,
                                height: '100%',
                                background: '#05ABA3',
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', color: '#475569', minWidth: '35px' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Modal Wrapper Component
export const EnlargeModal: React.FC<{
  chartIndex: number;
  data: ChartRawItem | null;
  onClose: () => void;
}> = ({ chartIndex, data, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      dir="rtl"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
          padding: '20px 24px',
          position: 'relative'
        }}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1.5px solid #e2e8f0',
            paddingBottom: '12px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📈</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0E5E5A' }}>
                {CH_TITLES[chartIndex] || `الرسم البياني ${chartIndex + 1}`}
              </h3>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                عرض تفاعلي موسع بدقة عالية مع إمكانية التبديل بين الأعمدة والدوائر وتفصيل البيانات.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: 700
            }}
            title="إغلاق (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Chart Renderer */}
        <InteractiveChart
          chartIndex={chartIndex}
          data={data}
          isModal={true}
        />

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '16px',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '12px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0E5E5A',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            تم / إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

// Global Store of mounted React Roots to cleanly unmount on updates
const mountedRoots = new Map<HTMLElement, Root>();
let modalRoot: Root | null = null;

// Opens the enlarged chart modal on-demand
export function openChartEnlargeModal(chartIndex: number, allCharts: (ChartRawItem | null)[]) {
  const modalContainer = document.getElementById('chartModalHost') || (() => {
    const el = document.createElement('div');
    el.id = 'chartModalHost';
    document.body.appendChild(el);
    return el;
  })();

  if (!modalRoot) {
    modalRoot = createRoot(modalContainer);
  }

  const handleClose = () => {
    if (modalRoot) {
      modalRoot.render(null);
    }
  };

  const chartItem = allCharts[chartIndex] || null;
  modalRoot.render(
    <EnlargeModal
      chartIndex={chartIndex}
      data={chartItem}
      onClose={handleClose}
    />
  );
}

// Mounts Recharts into all report document containers
export function mountReportCharts(allCharts: (ChartRawItem | null)[]) {
  // Mount into report preview nodes (.interactive-chart-mount)
  const mounts = document.querySelectorAll<HTMLElement>('.interactive-chart-mount');
  mounts.forEach((container) => {
    const idxAttr = container.dataset.chartIndex;
    if (idxAttr == null) return;
    const idx = parseInt(idxAttr, 10);
    const data = allCharts[idx] || null;

    let root = mountedRoots.get(container);
    if (!root) {
      root = createRoot(container);
      mountedRoots.set(container, root);
    }

    root.render(
      <InteractiveChart
        chartIndex={idx}
        data={data}
        onEnlarge={(i) => openChartEnlargeModal(i, allCharts)}
      />
    );
  });
}
