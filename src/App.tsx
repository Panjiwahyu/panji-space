import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env belum diisi. Cek VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Menu = "dashboard" | "tasks" | "finance" | "planning" | "calendar";
type Priority = "low" | "medium" | "high";
type TransactionType = "income" | "expense" | "saving";
type TransactionCategory = "makan" | "transport" | "kuliah" | "hiburan" | "darurat";

type Task = {
  id: string;
  user_id: string;
  title: string;
  deadline: string;
  done: boolean;
  priority: Priority;
};

type Transaction = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: TransactionType;
  transaction_date: string;
  category: TransactionCategory;
};

type Plan = {
  id: string;
  user_id: string;
  title: string;
  plan_date: string;
  plan_time: string;
};

type Holiday = {
  date: string;
  localName: string;
  name: string;
};

type CalendarDay = {
  date: string;
  label: number;
  tasks: Task[];
  plans: Plan[];
  holiday?: Holiday;
} | null;

const CLOUD_NAME = "dpdc6e6ws";
const UPLOAD_PRESET = "ml_default";

const categoryLabels: Record<TransactionCategory, string> = {
  makan: "Makan",
  transport: "Transport",
  kuliah: "Kuliah",
  hiburan: "Hiburan",
  darurat: "Darurat",
};

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityOrder: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export default function EduDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [activeMenu, setActiveMenu] = useState<Menu>("dashboard");
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionName, setTransactionName] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [transactionCategory, setTransactionCategory] = useState<TransactionCategory>("makan");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [weeklyBudget, setWeeklyBudget] = useState(() => {
    const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return Number(localStorage.getItem(`weekly-budget-${key}`) || 0);
  });
  const [monthlySavingTarget, setMonthlySavingTarget] = useState(() => {
    const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return Number(localStorage.getItem(`saving-target-${key}`) || 500000);
  });

  const [plans, setPlans] = useState<Plan[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [planTime, setPlanTime] = useState("");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [profileImage, setProfileImage] = useState(
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces"
  );

  const inputClass = "h-10 rounded-xl bg-[#0b1120]/85 border-[#273449] text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-300/25 focus-visible:border-cyan-300/40 transition-all";
  const selectClass = "h-10 rounded-xl border border-[#273449] px-3 bg-[#0b1120]/85 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/25 transition-all";
  const cardClass = "rounded-2xl bg-[#101827]/88 border border-[#243044] shadow-[0_18px_60px_rgba(0,0,0,0.22)] hover:bg-[#121d2f] hover:border-cyan-300/20 transition-all duration-200";
  const primaryButton = "h-10 rounded-xl bg-gradient-to-r from-slate-200 via-cyan-200 to-sky-300 text-slate-950 font-semibold shadow-[0_12px_30px_rgba(34,211,238,0.12)] hover:brightness-105 active:scale-[0.99] transition-all";
  const secondaryButton = "h-10 rounded-xl bg-[#101827] border border-[#273449] text-slate-200 hover:bg-[#162237] transition-all";
  const premiumPanel = "rounded-2xl bg-[#101827]/90 border border-[#243044] shadow-[0_18px_60px_rgba(0,0,0,0.22)]";

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    initAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    localStorage.setItem(`saving-target-${key}`, String(monthlySavingTarget));
  }, [monthlySavingTarget]);

  useEffect(() => {
    const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    localStorage.setItem(`weekly-budget-${key}`, String(weeklyBudget));
  }, [weeklyBudget]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const year = currentDate.getFullYear();
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
        const data: Holiday[] = await res.json();
        setHolidays(data);
      } catch (error) {
        console.error("Gagal mengambil tanggal merah:", error);
        setHolidays([]);
      }
    };

    fetchHolidays();
  }, [currentDate]);


  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };


  const loadData = async () => {
    if (!user) return;

    const [tasksRes, transactionsRes, plansRes, profileRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("deadline", { ascending: true }),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false }),
      supabase.from("plans").select("*").eq("user_id", user.id).order("plan_date", { ascending: true }),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (profileRes.data?.avatar_url) setProfileImage(profileRes.data.avatar_url);
  };

  const login = async () => {
    if (!email.trim() || !password.trim()) return alert("Email dan password wajib diisi.");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) alert(error.message);
  };

  const register = async () => {
    if (!email.trim() || !password.trim()) return alert("Email dan password wajib diisi.");

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) return alert(error.message);
    alert("Register berhasil. Sekarang coba login.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTasks([]);
    setTransactions([]);
    setPlans([]);
  };

  const addTask = async (customDate?: string) => {
    if (!user || !taskInput.trim()) return;

    const taskDeadline = customDate || deadline;
    if (!taskDeadline) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: taskInput.trim(),
        deadline: taskDeadline,
        done: false,
        priority,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setTasks((prev) => [...prev, data as Task]);
    setTaskInput("");
    setDeadline("");
    setPriority("medium");
    setSelectedDate(null);
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return alert(error.message);
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const toggleDone = async (task: Task) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({ done: !task.done })
      .eq("id", task.id)
      .select()
      .single();

    if (error) return alert(error.message);
    setTasks((prev) => prev.map((item) => (item.id === task.id ? (data as Task) : item)));
  };

  const handleDropTask = async (taskId: string, newDate: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const { error } = await supabase.from("tasks").update({ deadline: newDate }).eq("id", task.id);
    if (error) return alert(error.message);

    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, deadline: newDate } : item)));
  };

  const addTransaction = async () => {
    if (!user || !transactionName.trim() || !transactionAmount) return;

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        name: transactionName.trim(),
        amount: Number(transactionAmount),
        type: transactionType,
        transaction_date: transactionDate,
        category: transactionCategory,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setTransactions((prev) => [data as Transaction, ...prev]);
    setTransactionName("");
    setTransactionAmount("");
    setTransactionType("expense");
    setTransactionCategory("makan");
    setTransactionDate(formatLocalDate(new Date()));
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return alert(error.message);
    setTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  const addPlan = async (customDate?: string) => {
    if (!user || !planTitle.trim() || !planTime) return;

    const targetDate = customDate || planDate;

    const { data, error } = await supabase
      .from("plans")
      .insert({
        user_id: user.id,
        title: planTitle.trim(),
        plan_date: targetDate,
        plan_time: planTime,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setPlans((prev) => [...prev, data as Plan]);
    setPlanTitle("");
    setPlanDate(formatLocalDate(new Date()));
    setPlanTime("");
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return alert(error.message);
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
  };

  const uploadProfile = async (file: File) => {
    if (!user) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.secure_url) return alert(data.error?.message || "Upload gagal");

    setProfileImage(data.secure_url);

    await supabase.from("profiles").upsert({
      id: user.id,
      name: "Panji",
      avatar_url: data.secure_url,
    });
  };

  const formatRupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);

  const getCountdown = (date: string) => {
    const now = new Date();
    const due = new Date(date);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return "Terlambat";
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Besok";
    return `${diff} hari lagi`;
  };

  const getTaskColor = (task: Task) => {
    if (task.done) return "bg-emerald-500/25 border-emerald-400/30 text-emerald-100";
    if (task.priority === "high") return "bg-fuchsia-500/25 border-fuchsia-400/30 text-fuchsia-100";

    const today = new Date();
    const due = new Date(task.deadline);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 1) return "bg-rose-500/25 border-rose-400/30 text-rose-100";
    return "bg-sky-500/25 border-sky-400/30 text-sky-100";
  };

  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount), 0);

  const totalExpense = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount), 0);

  const totalSaving = transactions
    .filter((item) => item.type === "saving")
    .reduce((total, item) => total + Number(item.amount), 0);

  const remainingMoney = totalIncome - totalExpense - totalSaving;

  const monthlySaving = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((item) => {
        const date = new Date(item.transaction_date);
        return item.type === "saving" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((total, item) => total + Number(item.amount), 0);
  }, [transactions]);

  const savingTargetProgress = monthlySavingTarget <= 0 ? 0 : Math.min(100, Math.round((monthlySaving / monthlySavingTarget) * 100));
  const remainingSavingTarget = Math.max(0, monthlySavingTarget - monthlySaving);
  const remainingWeeksThisMonth = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const remainingDays = Math.max(1, lastDay.getDate() - now.getDate() + 1);
    return Math.max(1, Math.ceil(remainingDays / 7));
  }, []);
  const weeklySavingNeeded = Math.ceil(remainingSavingTarget / remainingWeeksThisMonth);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority || "medium"] - priorityOrder[a.priority || "medium"];
      const deadlineDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return priorityDiff || deadlineDiff;
    });
  }, [tasks]);

  const weeklyExpense = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return transactions
      .filter((item) => {
        const date = new Date(item.transaction_date);
        return item.type === "expense" && date >= weekStart && date <= weekEnd;
      })
      .reduce((total, item) => total + Number(item.amount), 0);
  }, [transactions]);

  const biggestExpenseCategory = useMemo(() => {
    const totals = transactions
      .filter((item) => item.type === "expense")
      .reduce((acc, item) => {
        const category = item.category || "makan";
        acc[category] = (acc[category] || 0) + Number(item.amount);
        return acc;
      }, {} as Record<TransactionCategory, number>);

    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  }, [transactions]);

  const upcomingTasks = useMemo(() => {
    return tasks.filter((task) => {
      const diff = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return !task.done && diff <= 3;
    });
  }, [tasks]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      if (filterStartDate && item.transaction_date < filterStartDate) return false;
      if (filterEndDate && item.transaction_date > filterEndDate) return false;
      return true;
    });
  }, [transactions, filterStartDate, filterEndDate]);

  const filteredIncome = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount), 0);

  const filteredExpense = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount), 0);

  const filteredSaving = filteredTransactions
    .filter((item) => item.type === "saving")
    .reduce((total, item) => total + Number(item.amount), 0);

  const filteredRemaining = filteredIncome - filteredExpense - filteredSaving;

  const completedTasks = tasks.filter((task) => task.done).length;
  const taskProgress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const quotes = [
    "Kerjakan sedikit demi sedikit, yang penting konsisten.",
    "Fokus satu tugas dulu, nanti yang lain menyusul.",
    "Disiplin hari ini bikin hidup besok lebih ringan.",
    "Jangan tunggu mood, mulai dulu 5 menit.",
    "Tugas selesai, pikiran jadi lebih tenang.",
  ];

  const randomQuote = quotes[new Date().getDay() % quotes.length];
  const displayName = user?.email?.split("@")[0] || "Panji";
  const closestTask = sortedTasks.find((task) => !task.done);
  const weekBudgetProgress = weeklyBudget <= 0 ? 0 : Math.min(100, Math.round((weeklyExpense / weeklyBudget) * 100));

  const chartData = [
    { name: "Pemasukan", value: totalIncome },
    { name: "Pengeluaran", value: totalExpense },
    { name: "Tabungan", value: totalSaving },
  ];

  const chartColors = ["#4ade80", "#fb7185", "#67e8f9"];

  const menuItems: [Menu, string, string][] = [
    ["dashboard", "Dashboard", "✦"],
    ["tasks", "Tugas", "✓"],
    ["finance", "Keuangan", "Rp"],
    ["planning", "Planning", "↗"],
    ["calendar", "Calendar", "◷"],
  ];

  const weeklyChartData = useMemo(() => {
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = formatLocalDate(date);
      const dayTransactions = transactions.filter((item) => item.transaction_date === key);

      return {
        day: days[date.getDay()],
        Pemasukan: dayTransactions
          .filter((item) => item.type === "income")
          .reduce((total, item) => total + Number(item.amount), 0),
        Pengeluaran: dayTransactions
          .filter((item) => item.type === "expense")
          .reduce((total, item) => total + Number(item.amount), 0),
        Tabungan: dayTransactions
          .filter((item) => item.type === "saving")
          .reduce((total, item) => total + Number(item.amount), 0),
      };
    });
  }, [transactions]);

  const monthlyChartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const currentYear = new Date().getFullYear();

    return months.map((month, index) => {
      const monthTransactions = transactions.filter((item) => {
        const date = new Date(item.transaction_date);
        return date.getFullYear() === currentYear && date.getMonth() === index;
      });

      return {
        month,
        Pemasukan: monthTransactions
          .filter((item) => item.type === "income")
          .reduce((total, item) => total + Number(item.amount), 0),
        Pengeluaran: monthTransactions
          .filter((item) => item.type === "expense")
          .reduce((total, item) => total + Number(item.amount), 0),
        Tabungan: monthTransactions
          .filter((item) => item.type === "saving")
          .reduce((total, item) => total + Number(item.amount), 0),
      };
    });
  }, [transactions]);

  const calendarDaysMonthly = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const days: CalendarDay[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const key = formatLocalDate(date);

      days.push({
        date: key,
        label: i,
        tasks: tasks.filter((task) => task.deadline === key),
        plans: plans.filter((plan) => plan.plan_date === key),
        holiday: holidays.find((holiday) => holiday.date === key),
      });
    }

    return days;
  }, [tasks, plans, holidays, currentDate]);

  const exportFinancePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Rekap Keuangan Panji Space", 14, 20);

    doc.setFontSize(11);
    doc.text(`Tanggal export: ${new Date().toLocaleDateString("id-ID")}`, 14, 30);
    doc.text(`Filter: ${filterStartDate || "-"} sampai ${filterEndDate || "-"}`, 14, 38);

    doc.setFontSize(13);
    doc.text(`Pemasukan: ${formatRupiah(filteredIncome)}`, 14, 52);
    doc.text(`Pengeluaran: ${formatRupiah(filteredExpense)}`, 14, 62);
    doc.text(`Tabungan: ${formatRupiah(filteredSaving)}`, 14, 72);
    doc.text(`Sisa Uang: ${formatRupiah(filteredRemaining)}`, 14, 82);

    let y = 100;
    doc.setFontSize(14);
    doc.text("Detail Transaksi", 14, y);
    y += 10;
    doc.setFontSize(10);

    filteredTransactions.forEach((item, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      const type = item.type === "income" ? "Pemasukan" : item.type === "expense" ? "Pengeluaran" : "Tabungan";

      doc.text(
        `${index + 1}. ${item.transaction_date} - ${item.name} - ${type} - ${categoryLabels[item.category || "makan"]} - ${formatRupiah(Number(item.amount))}`,
        14,
        y
      );

      y += 8;
    });

    doc.save("rekap-keuangan.pdf");
  };

  const moveMonth = (value: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + value, 1));
  };

  const menuClass = (menu: Menu) =>
    activeMenu === menu
      ? "bg-gradient-to-r from-slate-200 via-cyan-200 to-sky-300 text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.12)]"
      : "bg-transparent text-slate-400 hover:bg-[#101827] hover:text-white";

  if (loading) {
    return <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_35%)]" />

        <Card className="relative z-10 w-full max-w-md bg-slate-950/45 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl">
          <CardContent className="p-8">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2 bg-gradient-to-r from-fuchsia-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Panji Space
            </h1>
            <p className="text-slate-400 mb-6">Login untuk sinkronisasi tugas, keuangan, planning, dan calendar kamu.</p>

            <div className="space-y-3">
              <Input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input
                className={inputClass}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button className={`w-full ${primaryButton}`} onClick={login}>
                Login
              </Button>
              <Button className="w-full border-slate-800 text-white hover:bg-slate-800" variant="outline" onClick={register}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-[#060a12] text-slate-100 overflow-hidden selection:bg-cyan-300/25">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(34,211,238,0.09),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.18),rgba(7,11,20,0.98))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />

      <aside className="relative z-20 hidden lg:flex w-[276px] min-h-screen flex-col border-r border-[#243044] bg-[#070b14]/95 p-5 backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-3 px-1 py-1">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-200 via-cyan-200 to-sky-300 text-sm font-black text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.14)]">PS</div>
          <div>
            <div className="text-lg font-bold tracking-tight text-white">Panji Space</div>
            <p className="text-xs text-slate-500">Focus • Money • Plan</p>
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-3xl border border-cyan-200/10 bg-gradient-to-b from-[#121b2c] to-[#0b1120] p-3 shadow-[0_14px_48px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={profileImage} className="h-11 w-11 rounded-2xl object-cover ring-1 ring-cyan-200/25" />
              <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0b1120] bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-2">
              <p className="text-sm font-semibold text-white">{savingTargetProgress}%</p>
              <p className="text-[11px] text-slate-500">Target</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-2">
              <p className="text-sm font-semibold text-cyan-200">{upcomingTasks.length}</p>
              <p className="text-[11px] text-slate-500">Deadline</p>
            </div>
          </div>
          <label className="mt-3 block cursor-pointer rounded-xl border border-cyan-200/10 px-3 py-2 text-center text-xs font-medium text-cyan-100/70 hover:border-cyan-200/25 hover:bg-cyan-200/5 hover:text-cyan-100 transition">
            Edit profil
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadProfile(file);
              }}
            />
          </label>
        </div>

        <div className="space-y-2">
          {menuItems.map(([key, label, icon]) => (
            <Button key={key} className={`w-full justify-start gap-3 h-11 rounded-xl px-3 ${menuClass(key)}`} onClick={() => setActiveMenu(key)}>
              <span className="w-6 text-center text-sm opacity-90">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </Button>
          ))}

          <Button className="mt-5 w-full justify-start h-11 rounded-xl bg-transparent text-rose-400 hover:bg-rose-500/10 border border-transparent" onClick={logout}>
            Logout
          </Button>
        </div>
      </aside>

      <div className="fixed bottom-4 left-4 right-4 z-30 grid grid-cols-5 gap-1 rounded-2xl border border-slate-800 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {menuItems.map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setActiveMenu(key)}
            className={`rounded-xl px-2 py-2.5 text-xs font-medium transition-all ${activeMenu === key ? "bg-gradient-to-r from-slate-200 to-cyan-300 text-slate-950" : "text-slate-500 hover:bg-slate-900 hover:text-white"}`}
          >
            <span className="block text-sm leading-none">{icon}</span>
            <span className="mt-1 block truncate">{label}</span>
          </button>
        ))}
      </div>

      <main className="relative z-10 flex-1 p-4 pb-28 md:p-5 xl:p-7 overflow-y-auto">
        {activeMenu === "dashboard" && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <Card className="overflow-hidden rounded-3xl border border-cyan-200/10 bg-[linear-gradient(135deg,rgba(16,24,39,0.95),rgba(10,16,28,0.95))] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="mb-2 text-xs font-medium tracking-[0.14em] uppercase text-cyan-200/60">Workspace</p>
                      <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        Halo, {displayName} 👋
                      </h1>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{randomQuote}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-black/20 p-2 text-center">
                      <div className="rounded-lg px-3 py-2">
                        <p className="text-base font-semibold text-white">{tasks.length}</p>
                        <p className="text-[11px] text-slate-500">Tugas</p>
                      </div>
                      <div className="rounded-lg px-3 py-2">
                        <p className="text-base font-semibold text-emerald-300">{completedTasks}</p>
                        <p className="text-[11px] text-slate-500">Selesai</p>
                      </div>
                      <div className="rounded-lg px-3 py-2">
                        <p className="text-base font-semibold text-cyan-200">{savingTargetProgress}%</p>
                        <p className="text-[11px] text-slate-500">Target</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-cyan-200/10 bg-[linear-gradient(135deg,rgba(16,24,39,0.95),rgba(10,16,28,0.95))] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Prioritas dekat</p>
                      <p className="mt-1 text-xs text-slate-500">Deadline 3 hari</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">{upcomingTasks.length}</span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {closestTask ? closestTask.title : "Tidak ada tugas mendesak"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{upcomingTasks.length} tugas belum selesai</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, upcomingTasks.length * 25)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 mb-5">
              {[
                ["Total tugas", tasks.length, "text-white", "Tugas aktif", "bg-cyan-300/10 text-cyan-200"],
                ["Selesai", completedTasks, "text-emerald-300", "Progress belajar", "bg-emerald-400/10 text-emerald-300"],
                ["Tabungan", formatRupiah(totalSaving), "text-cyan-200", "Dana tersimpan", "bg-cyan-300/10 text-cyan-200"],
                ["Sisa uang", formatRupiah(remainingMoney), remainingMoney < 0 ? "text-rose-300" : "text-white", "Saldo berjalan", remainingMoney < 0 ? "bg-rose-400/10 text-rose-300" : "bg-violet-400/10 text-violet-300"],
                ["Target", `${savingTargetProgress}%`, "text-cyan-300", "Bulan ini", "bg-cyan-400/10 text-cyan-300"],
              ].map(([title, value, color, desc, badge]) => (
                <Card key={title} className="group max-w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65 transition-all duration-200 hover:bg-slate-900 hover:border-slate-700">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <p className="text-xs font-medium text-slate-500">{title}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${badge}`}>●</span>
                    </div>
                    <p className={`text-lg font-semibold tracking-tight truncate ${color}`}>{value}</p>
                    <p className="mt-2 text-xs text-slate-500">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-5 mb-6">
              <Card className={premiumPanel}>
                <CardContent className="p-5">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Target Tabungan Bulanan</h2>
                      <p className="mt-1 text-sm text-slate-500">Pantau target, progress, dan nominal yang perlu ditabung per minggu.</p>
                    </div>
                    <Input
                      className={`${inputClass} md:max-w-44`}
                      type="number"
                      value={monthlySavingTarget || ""}
                      onChange={(e) => setMonthlySavingTarget(Number(e.target.value))}
                      placeholder="500000"
                    />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 text-sm">
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="mt-1 font-bold text-white">{formatRupiah(monthlySavingTarget)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <p className="text-xs text-slate-500">Terkumpul</p>
                      <p className="mt-1 font-bold text-cyan-200">{formatRupiah(monthlySaving)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <p className="text-xs text-slate-500">Sisa target</p>
                      <p className="mt-1 font-bold text-rose-300">{formatRupiah(remainingSavingTarget)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <p className="text-xs text-slate-500">Per minggu</p>
                      <p className="mt-1 font-bold text-emerald-300">{formatRupiah(weeklySavingNeeded)}</p>
                    </div>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-slate-200 via-cyan-200 to-sky-300" style={{ width: `${savingTargetProgress}%` }} />
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>Progress tabungan</span>
                    <span className="font-bold text-cyan-200">{savingTargetProgress}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={premiumPanel}>
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-white">Ringkasan Minggu Ini</h2>
                  <p className="mt-1 text-sm text-slate-500">Budget dan progress tugas dalam satu pandangan.</p>
                  <div className="mt-6 space-y-5">
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-slate-400">Budget</span>
                        <span className={weeklyBudget > 0 && weeklyExpense > weeklyBudget ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{weekBudgetProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${weeklyBudget > 0 && weeklyExpense > weeklyBudget ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${weekBudgetProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{formatRupiah(weeklyExpense)} / {formatRupiah(weeklyBudget)}</p>
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-slate-400">Progress tugas</span>
                        <span className="font-bold text-cyan-200">{taskProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${taskProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{completedTasks} dari {tasks.length} tugas selesai</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className={`${premiumPanel} mb-6`}>
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold mb-5 text-white">Insight Otomatis</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-xs text-slate-500 mb-2">Pengeluaran terbesar</p>
                    <p className="font-bold text-rose-300 capitalize">{biggestExpenseCategory ? categoryLabels[biggestExpenseCategory[0] as TransactionCategory] : "Belum ada"}</p>
                    <p className="mt-1 text-slate-400">{biggestExpenseCategory ? formatRupiah(biggestExpenseCategory[1]) : formatRupiah(0)}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-xs text-slate-500 mb-2">Deadline 3 hari</p>
                    <p className="font-bold text-cyan-300">{upcomingTasks.length} tugas</p>
                    <p className="mt-1 text-slate-400">Cek menu Tugas Kuliah</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-xs text-slate-500 mb-2">Budget minggu ini</p>
                    <p className={weeklyBudget > 0 && weeklyExpense > weeklyBudget ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>
                      {formatRupiah(weeklyExpense)} / {formatRupiah(weeklyBudget)}
                    </p>
                    <p className="mt-1 text-slate-400">{weeklyBudget > 0 && weeklyExpense > weeklyBudget ? "Melebihi budget" : "Masih aman"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
              <Card className={premiumPanel}>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-5 text-white">Progress Tugas</h2>
                  <div className="mb-3 flex justify-between text-sm text-slate-400">
                    <span>{completedTasks} tugas selesai</span>
                    <span className="font-bold text-cyan-200">{taskProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-300 to-blue-500 h-3 rounded-full" style={{ width: `${taskProgress}%` }} />
                  </div>
                </CardContent>
              </Card>

              <Card className={premiumPanel}>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-white">Diagram Keuangan</h2>
                  <div className="w-full h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={88} innerRadius={52} paddingAngle={4} label>
                          {chartData.map((_, index) => (
                            <Cell key={index} fill={chartColors[index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className={premiumPanel}>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-white">Chart Mingguan</h2>
                <div className="w-full h-72">
                  <ResponsiveContainer>
                    <BarChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="Pemasukan" fill="#34d399" radius={[10, 10, 0, 0]} />
                      <Bar dataKey="Pengeluaran" fill="#fb7185" radius={[10, 10, 0, 0]} />
                      <Bar dataKey="Tabungan" fill="#67e8f9" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeMenu === "tasks" && (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">Tugas Kuliah</h1>

            <Card className={`${cardClass} mb-6`}>
              <CardContent className="p-5 flex flex-col xl:flex-row gap-3">
                <Input className={inputClass} placeholder="Masukkan tugas kuliah" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} />
                <Input className={inputClass} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <Button className={primaryButton} onClick={() => addTask()}>
                  Tambah
                </Button>
              </CardContent>
            </Card>

            {tasks.length === 0 && <p className="text-slate-400">Belum ada tugas kuliah.</p>}

            {sortedTasks.map((task) => (
              <div key={task.id} className={`p-4 mb-3 rounded-3xl border shadow flex justify-between items-center ${getTaskColor(task)}`}>
                <div>
                  <p className={`font-semibold ${task.done ? "line-through" : ""}`}>{task.title}</p>
                  <p className="text-sm opacity-80">Deadline: {getCountdown(task.deadline)}</p>
                  <p className="text-xs opacity-80">Priority: {priorityLabels[task.priority || "medium"]}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => toggleDone(task)}>
                    {task.done ? "Batal" : "Selesai"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteTask(task.id)}>
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        {activeMenu === "finance" && (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">Keuangan</h1>

            {weeklyBudget > 0 && weeklyExpense > weeklyBudget && (
              <div className="mb-6 rounded-3xl border border-rose-400/30 bg-rose-500/20 p-4 text-rose-100">
                ⚠️ Pengeluaran minggu ini sudah melewati budget: {formatRupiah(weeklyExpense)} dari {formatRupiah(weeklyBudget)}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5 mb-6">
              {[
                ["Pemasukan", formatRupiah(filteredIncome), "text-emerald-300"],
                ["Pengeluaran", formatRupiah(filteredExpense), "text-rose-300"],
                ["Tabungan", formatRupiah(filteredSaving), "text-cyan-200"],
                ["Sisa", formatRupiah(filteredRemaining), "text-fuchsia-300"],
              ].map(([title, value, color]) => (
                <Card key={title} className={cardClass}>
                  <CardContent className="p-5">
                    <p className="text-slate-400">{title}</p>
                    <p className={`text-lg font-semibold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className={`${cardClass} mb-6`}>
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold mb-4">Target Tabungan & Budget</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Target tabungan bulanan</p>
                    <Input
                      className={inputClass}
                      type="number"
                      placeholder="Contoh: 500000"
                      value={monthlySavingTarget || ""}
                      onChange={(e) => setMonthlySavingTarget(Number(e.target.value))}
                    />
                    <p className="text-sm text-slate-400 mt-2">
                      Harus nabung per minggu: <span className="text-emerald-300 font-semibold">{formatRupiah(weeklySavingNeeded)}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-2">Budget pengeluaran mingguan</p>
                    <Input
                      className={inputClass}
                      type="number"
                      placeholder="Contoh: 150000"
                      value={weeklyBudget || ""}
                      onChange={(e) => setWeeklyBudget(Number(e.target.value))}
                    />
                    <p className="text-sm text-slate-400 mt-2">
                      Pengeluaran minggu ini: <span className="text-rose-300 font-semibold">{formatRupiah(weeklyExpense)}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${cardClass} mb-6`}>
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold mb-4">Filter Tanggal</h2>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input className={inputClass} type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                  <Input className={inputClass} type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                  <Button variant="outline" className={secondaryButton} onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}>
                    Reset
                  </Button>
                  <Button className={primaryButton} onClick={exportFinancePDF}>
                    Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={`${cardClass} mb-6`}>
              <CardContent className="p-5 flex flex-col xl:flex-row gap-3">
                <Input className={inputClass} placeholder="Nama transaksi" value={transactionName} onChange={(e) => setTransactionName(e.target.value)} />
                <Input className={inputClass} type="number" placeholder="Nominal" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} />
                <Input className={inputClass} type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
                <select className={selectClass} value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType)}>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="saving">Tabungan</option>
                </select>
                <select className={selectClass} value={transactionCategory} onChange={(e) => setTransactionCategory(e.target.value as TransactionCategory)}>
                  <option value="makan">Makan</option>
                  <option value="transport">Transport</option>
                  <option value="kuliah">Kuliah</option>
                  <option value="hiburan">Hiburan</option>
                  <option value="darurat">Darurat</option>
                </select>
                <Button className={primaryButton} onClick={addTransaction}>
                  Tambah
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <Card className={cardClass}>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Grafik Mingguan</h2>
                  <div className="w-full h-72">
                    <ResponsiveContainer>
                      <BarChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip />
                        <Bar dataKey="Pemasukan" fill="#34d399" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Pengeluaran" fill="#fb7185" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Tabungan" fill="#67e8f9" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Grafik Bulanan</h2>
                  <div className="w-full h-72">
                    <ResponsiveContainer>
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip />
                        <Bar dataKey="Pemasukan" fill="#34d399" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Pengeluaran" fill="#fb7185" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Tabungan" fill="#67e8f9" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {filteredTransactions.length === 0 && <p className="text-slate-400">Belum ada transaksi pada periode ini.</p>}

            {filteredTransactions.map((item) => (
              <div key={item.id} className="p-4 mb-3 rounded-[28px] bg-slate-900/75 backdrop-blur-xl border border-white/12 shadow-[0_16px_50px_rgba(0,0,0,0.28)] flex justify-between items-center hover:border-cyan-300/30 transition">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-400">
                    {item.transaction_date} - {item.type === "income" ? "Pemasukan" : item.type === "expense" ? "Pengeluaran" : "Tabungan"} - {categoryLabels[item.category || "makan"]} - {formatRupiah(Number(item.amount))}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteTransaction(item.id)}>
                  Hapus
                </Button>
              </div>
            ))}
          </>
        )}

        {activeMenu === "planning" && (
          <>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">Planning</h1>

            <Card className={`${cardClass} mb-6`}>
              <CardContent className="p-5 flex flex-col xl:flex-row gap-3">
                <Input className={inputClass} placeholder="Contoh: Belajar React" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                <Input className={inputClass} type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
                <Input className={inputClass} type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} />
                <Button className={primaryButton} onClick={() => addPlan()}>
                  Tambah
                </Button>
              </CardContent>
            </Card>

            {plans.length === 0 && <p className="text-slate-400">Belum ada planning.</p>}

            {plans.map((plan) => (
              <div key={plan.id} className="p-4 mb-3 rounded-[28px] bg-slate-900/75 backdrop-blur-xl border border-white/12 shadow-[0_16px_50px_rgba(0,0,0,0.28)] flex justify-between items-center hover:border-cyan-300/30 transition">
                <div>
                  <p className="font-semibold">{plan.title}</p>
                  <p className="text-sm text-slate-400">
                    {plan.plan_date} - {plan.plan_time}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deletePlan(plan.id)}>
                  Hapus
                </Button>
              </div>
            ))}
          </>
        )}

        {activeMenu === "calendar" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Calendar Bulanan</h1>
                <p className="text-slate-400">Klik tanggal untuk tambah tugas, drag task untuk pindah deadline.</p>
              </div>

              <div className="flex gap-3 items-center">
                <Button className="bg-slate-800 hover:bg-white/20" onClick={() => moveMonth(-1)}>
                  ←
                </Button>
                <h2 className="text-xl font-semibold min-w-48 text-center">
                  {currentDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </h2>
                <Button className="bg-slate-800 hover:bg-white/20" onClick={() => moveMonth(1)}>
                  →
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-3 mb-3 text-center text-sm text-slate-400 min-w-[980px]">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="overflow-x-auto pb-3"><div className="grid grid-cols-7 gap-3 min-w-[980px]">
              {calendarDaysMonthly.map((day, index) =>
                day ? (
                  <Card
                    key={day.date}
                    className="min-h-36 bg-slate-900/75 backdrop-blur-xl border border-white/12 rounded-[28px] p-2 cursor-pointer hover:bg-slate-800/85 hover:border-cyan-300/30 transition"
                    onClick={() => setSelectedDate(day.date)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const taskId = e.dataTransfer.getData("taskId");
                      if (taskId) handleDropTask(taskId, day.date);
                    }}
                  >
                    <CardContent className="p-2">
                      <p className={`text-sm mb-2 ${day.holiday ? "text-rose-300 font-bold" : "text-slate-300"}`}>
                        {day.label}
                      </p>

                      {day.holiday && (
                        <div className="text-xs p-2 mb-2 rounded-xl border bg-rose-500/25 border-rose-400/30 text-rose-100">
                          🇮🇩 {day.holiday.localName}
                        </div>
                      )}

                      {day.tasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                          className={`text-xs p-2 mb-2 rounded-xl border ${getTaskColor(task)}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </div>
                      ))}

                      {day.plans.map((plan) => (
                        <div key={plan.id} className="text-xs p-2 mb-2 rounded-xl border bg-cyan-500/20 border-cyan-400/30 text-cyan-100">
                          {plan.plan_time} - {plan.title}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <div key={`empty-${index}`} />
                )
              )}
            </div>

            </div>

            {selectedDate && (
              <Card className={`${cardClass} mt-6`}>
                <CardContent className="p-5">
                  <h2 className="font-bold mb-3">Tambah Tugas - {selectedDate}</h2>
                  <div className="flex flex-col md:flex-row gap-3">
                    <Input className={inputClass} placeholder="Nama tugas" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} />
                    <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <Button className={primaryButton} onClick={() => addTask(selectedDate)}>
                      Tambah Tugas
                    </Button>
                    <Button variant="outline" className={secondaryButton} onClick={() => setSelectedDate(null)}>
                      Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}