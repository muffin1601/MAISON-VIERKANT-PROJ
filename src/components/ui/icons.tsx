/**
 * Central premium-icon registry (lucide-react). Thin 1.5px strokes suit the Cormorant/Jost
 * luxury theme. Import icons from here so sizing/usage stays consistent across the admin.
 */
export {
  LayoutDashboard,
  SlidersHorizontal,
  Armchair,
  Boxes,
  ShoppingBag,
  Inbox,
  Users,
  FilePlus2,
  FileText,
  PackageOpen,
  Pencil,
  FileUp,
  Upload,
  ImagePlus,
  Plus,
  X,
  Check,
  Trash2,
  RefreshCw,
  ArrowRight,
  LogOut,
  CloudUpload,
  Download,
  Star,
  Paperclip,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  SlidersHorizontal,
  Armchair,
  Boxes,
  ShoppingBag,
  Inbox,
  Users,
  FilePlus2,
  FileText,
  PackageOpen,
} from "lucide-react";

/** Map each admin nav route to its icon. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/admin/dashboard": LayoutDashboard,
  "/admin/pricing": SlidersHorizontal,
  "/admin/products": Armchair,
  "/admin/stock": Boxes,
  "/admin/orders": ShoppingBag,
  "/admin/leads": Inbox,
  "/admin/customers": Users,
  "/admin/quotes": FilePlus2,
  "/admin/saved-quotes": FileText,
  "/admin/purchase-orders": PackageOpen,
};
