import React, { useState } from "react";
import { 
  Wrench, 
  Truck, 
  ShieldCheck, 
  Clock, 
  Phone, 
  MapPin, 
  Mail, 
  ArrowRight, 
  Check, 
  Activity, 
  ChevronDown,
  HelpCircle,
  MessageSquare
} from "lucide-react";
import { DEFAULT_BRANDING } from "../services/branding";

export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const stats = [
    { value: "+15.000", label: "Equipos Reparados" },
    { value: "6 Meses", label: "Garantía Escrita" },
    { value: "100%", label: "Repuestos Originales" },
    { value: "24-48hs", label: "Tiempo de Respuesta" },
  ];

  const features = [
    {
      icon: Wrench,
      title: "Servicio Técnico Oficial Multi-Marca",
      desc: "Especialistas certificados en Drean, Whirlpool, LG, Samsung, Electrolux, Bosch y Philco."
    },
    {
      icon: Truck,
      title: "Logística y Traslado Propio",
      desc: "Retiramos y entregamos tu lavarropas en tu domicilio con vehículos equipados para máxima seguridad."
    },
    {
      icon: Activity,
      title: "Seguimiento Satelital en Tiempo Real",
      desc: "Monitoreá el estado de tu reparación y la ubicación exacta del transporte cuando tu equipo va en camino."
    },
    {
      icon: ShieldCheck,
      title: "Garantía Escrita & Calidad",
      desc: "Todas nuestras reparaciones cuentan con soporte post-venta y componentes 100% legítimos de fábrica."
    }
  ];

  const faqs = [
    {
      q: "¿Cuánto tiempo demora la reparación de un lavarropas?",
      a: "El diagnóstico inicial se realiza en un plazo de 24 a 48 horas. Una vez aprobado el presupuesto, la mayoría de las reparaciones se completan en 1 o 2 días hábiles, dependiendo de la disponibilidad de repuestos específicos de la marca."
    },
    {
      q: "¿Brindan garantía por el trabajo realizado?",
      a: "Sí, todas nuestras reparaciones cuentan con una garantía escrita de 6 meses que cubre tanto la mano de obra como los componentes reemplazados."
    },
    {
      q: "¿Qué zonas de cobertura tienen para retiros?",
      a: "Atendemos de forma directa en las ciudades de Santo Tomé, Santa Fe y zonas aledañas de la provincia. Contamos con logística propia optimizada por GPS."
    },
    {
      q: "¿Cómo puedo consultar el estado de mi orden?",
      a: "Cuando registramos tu equipo, te enviamos un enlace único de seguimiento satelital por WhatsApp o correo electrónico. Con ese enlace podrás ver el estado del diagnóstico y la ruta del repartidor en tiempo real."
    }
  ];

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-800 dark:text-gray-200 transition-colors duration-300 selection:bg-indigo-500 selection:text-white">
      {/* Sleek Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-100 dark:border-gray-800/60 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white block">
                EconoService
              </span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block -mt-1">
                Servicio Técnico Especializado
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#soluciones" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">Soluciones</a>
            <a href="#proceso" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">Proceso</a>
            <a href="#marcas" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">Marcas</a>
            <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">Preguntas</a>
            <a href="#contacto" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">Contacto</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-white to-slate-50 dark:from-gray-900 dark:to-gray-950 transition-colors">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-full text-indigo-700 dark:text-indigo-400 text-xs font-extrabold tracking-wide uppercase">
              <SparklesIcon className="w-3.5 h-3.5" />
              Líderes en Santo Tomé y Santa Fe
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1] font-display">
              Reparación Profesional de <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-indigo-400 dark:to-indigo-300">Lavarropas</span> a Domicilio
            </h1>
            <p className="text-sm sm:text-base text-slate-550 dark:text-gray-400 leading-relaxed max-w-xl">
              No dejes que un lavarropas roto altere tu rutina. En EconoService reparamos tu equipo con repuestos legítimos, garantía escrita de 6 meses y la comodidad de retiro y entrega en tu casa con ruteo GPS.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="https://wa.me/5493425000000"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Solicitar Servicio Técnico</span>
              </a>
              <a
                href="#soluciones"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 font-extrabold rounded-2xl text-xs sm:text-sm border border-slate-200 dark:border-gray-800 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Conocer Soluciones</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            {/* Visual illustration / active tracking mockup card */}
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-colors duration-500" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                    Seguimiento en Vivo
                  </span>
                </div>
                <span className="text-[10px] font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  Orden #002485
                </span>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Reparto en Progreso</h4>
                    <p className="text-[10px] text-slate-400 dark:text-gray-500">Logística EconoService de camino a tu casa</p>
                  </div>
                </div>

                {/* Progress stepper */}
                <div className="pl-9 space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100 dark:before:bg-indigo-950">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-gray-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950 shrink-0 z-10" />
                    <span>Retiro de Lavarropas Completado</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-550 dark:text-gray-450 text-indigo-600 dark:text-indigo-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950 shrink-0 z-10" />
                    <span>Diagnóstico de Falla Realizado</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60 shrink-0 z-10 animate-bounce" />
                    <span>Equipo en viaje de entrega</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-gray-850 p-3 rounded-2xl border border-slate-100 dark:border-gray-800 text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                  <strong>Estado del lavado:</strong> Falla en plaqueta principal reemplazada con repuesto oficial Drean Excellent. Dispositivo testeado y verificado en nuestro banco de pruebas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-indigo-900 text-white py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-3xl sm:text-4xl font-black block tracking-tight">{stat.value}</span>
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest block">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Soluciones Section */}
      <section id="soluciones" className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Nuestras Soluciones</span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">Por Qué Elegir EconoService</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
            Ofrecemos un servicio moderno, rápido y tecnológico diseñado exclusivamente para la reparación de lavarropas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 p-6 rounded-3xl shadow-3xs flex gap-4 hover:border-indigo-100 dark:hover:border-indigo-900/40 transition-all hover:shadow-xs text-left">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0 h-fit">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{feat.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proceso de Reparación Section */}
      <section id="proceso" className="py-20 bg-slate-100/50 dark:bg-gray-900/30 border-y border-slate-150 dark:border-gray-800/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto space-y-3 mb-16">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">El Proceso</span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">Cómo Reparamos tu Lavarropas</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
              Un recorrido ágil desde tu llamado hasta la entrega de tu lavarropas funcionando como nuevo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Contacto y Agenda", desc: "Nos enviás un WhatsApp o llamás. Coordinamos el retiro de tu lavarropas en la fecha y rango horario que te convenga." },
              { step: "02", title: "Retiro y Ruteo GPS", desc: "Nuestra camioneta retira el lavarropas en tu domicilio. El chofer te entrega tu orden física con código QR." },
              { step: "03", title: "Diagnóstico y Presupuesto", desc: "El técnico evalúa el equipo en taller, detecta la falla y te notificamos el presupuesto detallado para su aprobación." },
              { step: "04", title: "Reparación y Entrega", desc: "Reparamos y realizamos rigurosos tests de lavado antes de coordinar el retorno del equipo a tu domicilio." }
            ].map((step, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 p-6 rounded-3xl shadow-3xs space-y-3 relative text-left">
                <span className="text-3xl font-black text-indigo-500/20 dark:text-indigo-500/10 block">{step.step}</span>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marcas Section */}
      <section id="marcas" className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto space-y-3 mb-12">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Marcas Soportadas</span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">Servicio Técnico Multi-Marca Especializado</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 pt-4">
          {["Drean", "Whirlpool", "LG", "Samsung", "Electrolux", "Philco"].map((brand, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 p-5 rounded-2xl flex items-center justify-center font-extrabold text-base text-slate-700 dark:text-gray-300 shadow-3xs group hover:border-indigo-150 dark:hover:border-indigo-900/35 transition-colors">
              <span className="group-hover:scale-105 transition-transform duration-200 font-display uppercase tracking-widest">{brand}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-100/50 dark:bg-gray-900/30 border-t border-slate-150 dark:border-gray-800/40">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center space-y-3 mb-12">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block flex items-center justify-center gap-1.5">
              <HelpCircle className="w-4.5 h-4.5 text-indigo-500" /> Preguntas Frecuentes
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">Resolvé tus Dudas</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-850/20 transition-all"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div 
                    className={`transition-all duration-300 overflow-hidden ${
                      isOpen ? "max-h-[200px] border-t border-slate-100 dark:border-gray-800/60" : "max-h-0"
                    }`}
                  >
                    <p className="p-6 text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contacto Section */}
      <section id="contacto" className="py-20 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-6 text-left">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Contacto</span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">Estamos para ayudarte</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
              Comunicate directamente con nuestras oficinas o escribinos por WhatsApp para coordinar tu servicio.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teléfono / WhatsApp</span>
                  <a href="tel:+5493425000000" className="text-xs sm:text-sm font-bold hover:text-indigo-600 transition-colors">+54 9 342 500-0000</a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taller Central</span>
                  <span className="text-xs sm:text-sm font-semibold">Av. Luján 2845, Santo Tomé, Santa Fe</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                  <a href="mailto:soporte@econoservice.com.ar" className="text-xs sm:text-sm font-bold hover:text-indigo-600 transition-colors">soporte@econoservice.com.ar</a>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {/* Contact details / Message Form Card */}
            <div className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xs text-left">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Envianos tu consulta</h3>
              <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre Completo</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Juan Pérez"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-850 text-slate-950 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Celular / Teléfono</label>
                    <input 
                      type="tel" 
                      placeholder="Ej. 3425000000"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-850 text-slate-950 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle del problema del lavarropas</label>
                  <textarea 
                    rows={4} 
                    placeholder="Ej. Mi lavarropas Drean no centrifuga y hace un ruido fuerte al desagotar..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-850 text-slate-950 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-indigo-600/10 active:scale-95 transition-all cursor-pointer text-center"
                >
                  Enviar Mensaje por WhatsApp
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              EconoService
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            &copy; {new Date().getFullYear()} EconoService. Todos los derechos reservados. Santo Tomé, Santa Fe, Argentina.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Sparkles local SVG fallback to prevent missing imports
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
    </svg>
  );
}
