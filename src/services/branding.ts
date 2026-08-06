import { supabase } from "../lib/supabase";
import { BrandingConfig } from "../types";

export const DEFAULT_BRANDING: BrandingConfig = {
  logo: "/logo.png",
  titulo: "EconoService",
  subtitulo: "Gestión de Servicio Técnico de Electrodomésticos",
  badge: "Migrado de MS Access • Google Auth Activo"
};

const CACHE_KEY = "econoservice_branding_config";

export const BrandingService = {
  getLocalConfig(): BrandingConfig {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error("Error reading local branding config:", err);
    }
    return DEFAULT_BRANDING;
  },

  updateDocumentTitle(title?: string) {
    if (typeof document !== "undefined") {
      document.title = title || DEFAULT_BRANDING.titulo;
    }
  },

  async getConfig(): Promise<BrandingConfig> {
    try {
      const { data, error } = await supabase.from("config").select("*").eq("id", "branding").single();
      if (data && !error) {
        const config: BrandingConfig = {
          logo: data.logo || DEFAULT_BRANDING.logo,
          titulo: data.titulo || DEFAULT_BRANDING.titulo,
          subtitulo: data.subtitulo || DEFAULT_BRANDING.subtitulo,
          badge: data.badge || DEFAULT_BRANDING.badge,
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(config));
        } catch (e) {}
        this.updateDocumentTitle(config.titulo);
        return config;
      }
    } catch (err) {
      console.error("Error getting branding config from Supabase, falling back to cache:", err);
    }
    const fallback = this.getLocalConfig();
    this.updateDocumentTitle(fallback.titulo);
    return fallback;
  },

  async setConfig(config: BrandingConfig): Promise<void> {
    const sanitized = {
      id: "branding",
      logo: config.logo || "",
      titulo: config.titulo.trim() || DEFAULT_BRANDING.titulo,
      subtitulo: config.subtitulo.trim() || DEFAULT_BRANDING.subtitulo,
      badge: config.badge.trim() || DEFAULT_BRANDING.badge,
    };
    const { error } = await supabase.from("config").upsert(sanitized);
    if (error) throw error;

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
    } catch (e) {}
    this.updateDocumentTitle(sanitized.titulo);
  }
};
