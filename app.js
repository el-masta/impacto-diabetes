/**
 * Impacto de cambios en Diabetes tipo 2
 * Versión educativa sin fines comerciales
 *
 * Copyright (c) 2025 Mario Rodríguez (El_Masta)
 * 
 * Licenciado bajo: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
 * https://creativecommons.org/licenses/by-nc/4.0/
 * 
 * Usted es libre de:
 * Compartir — copiar y redistribuir el material en cualquier medio o formato
 * Adaptar — remezclar, transformar y construir a partir del material
 * 
 * Bajo las siguientes condiciones:
 * Atribución — Debe otorgar el crédito adecuado a Mario Rodríguez, proporcionar un enlace a la licencia e indicar si se realizaron cambios.
 * No Comercial — No puede utilizar el material con fines comerciales.
 * 
 * El texto completo de la licencia puede consultarse en:
 * https://creativecommons.org/licenses/by-nc/4.0/legalcode
 * 
 * --- Modelo educativo basado en evidencia científica ---
 * Referencias:
 * - Lean MEJ et al. (2018, The Lancet)
 * - Colberg SR et al. (2016, Diabetes Care)
 * - Esposito K et al. (2009, Annals of Internal Medicine)
 * - UKPDS Group (1998, The Lancet)
 *
 * Los resultados ofrecidos por esta herramienta son estimaciones orientativas y no sustituyen el consejo médico profesional.
 */

// Impacto de cambios en Diabetes tipo 2 - Modelo educativo basado en evidencia
// Esta app permite visualizar estimaciones orientativas sobre el impacto de cambios de rutina
// en personas con diabetes tipo 2. Basado en papers como Lean et al. 2018, Colberg et al. 2016, UKPDS, etc.
// Los resultados son educativos, no diagnósticos. Código Open Source.

const { createApp } = Vue;

createApp({
  data() {
    return {
      // Datos de entrada (inputs del formulario)
      edad: 50,
      sexo: 'masculino',
      pesoActual: 80,
      pesoMeta: 75,
      actividadActual: 'sedentario',
      mejoraActividad: 0,
      dietaActual: 'deficiente',
      mejoraDieta: 0,
      hba1cActual: 8.0,

      // Gráfico de HbA1c (Chart.js)
      chart: null,
      chartReady: false,
      debouncedUpdateChart: null,

      // Estado para mostrar u ocultar la guía de interpretación
      mostrarInterpretacion: false
    };
  },

  computed: {
    // HbA1c proyectada futura tras cambios
    hba1cReducida() {
      let reduccion = 0;

      // --- Pérdida de peso ---
      // Modelo no lineal, ponderado por HbA1c inicial
      const perdidaPesoPct = ((this.pesoActual - this.pesoMeta) / this.pesoActual) * 100;

      if (perdidaPesoPct > 0) {
        const pct1 = Math.min(perdidaPesoPct, 5);
        const pct2 = Math.min(Math.max(perdidaPesoPct - 5, 0), 5);
        const pct3 = Math.max(perdidaPesoPct - 10, 0);

        const factorBase = (this.hba1cActual >= 9) ? 1.2 : (this.hba1cActual >= 8 ? 1.0 : 0.8);

        reduccion += factorBase * (
          0.1 * pct1 +
          0.05 * pct2 +
          0.02 * pct3
        );
      }

      // --- Mejora actividad física ---
      // Basado en sqrt(nivel proyectado), max 0.6%
      const actividadPct = this.nivelActividadProyectado();
      const actividadFactor = Math.sqrt(actividadPct / 100);
      reduccion += 0.6 * actividadFactor;

      // --- Mejora dieta ---
      // Basado en sqrt(nivel proyectado), max 0.5%
      const dietaPct = this.nivelDietaProyectado();
      const dietaFactor = Math.sqrt(dietaPct / 100);
      reduccion += 0.5 * dietaFactor;

      // HbA1c proyectada final (mínimo 3.5%)
      return Math.max(3.5, this.hba1cActual - reduccion).toFixed(2);
    },

    // Interpretación textual de la HbA1c proyectada
    hba1cText() {
      const hba1c = this.hba1cReducida;

      if (hba1c < 4.0) {
        return 'Bajo';
      } else if (hba1c < 5.7) {
        return 'Normal';
      } else if (hba1c < 6.5) {
        return 'Prediabetes';
      } else if (hba1c <= 7.0) {
        return 'Control bueno';
      } else if (hba1c <= 8.0) {
        return 'Control intermedio';
      } else {
        return 'Control pobre';
      }
    },

    // Descripción de la mejora proyectada en actividad física
    actividadMejoraTexto() {
      const val = this.mejoraActividad;
      if (val === 0) return 'Sin cambios respecto a la actividad actual';
      if (val > 0 && val <= 30) return 'Pequeña mejora (más caminatas, + movimiento diario)';
      if (val > 30 && val <= 60) return 'Mejora moderada (actividad regular planificada)';
      return 'Gran mejora (rutina de ejercicio estructurada, frecuente)';
    },

    // Descripción de la mejora proyectada en alimentación
    dietaMejoraTexto() {
      const val = this.mejoraDieta;
      if (val === 0) return 'Sin cambios respecto a la alimentación actual';
      if (val > 0 && val <= 30) return 'Pequeña mejora (menos ultraprocesados, más frutas y verduras)';
      if (val > 30 && val <= 60) return 'Mejora moderada (patrón alimentario más saludable de forma sostenida)';
      return 'Gran mejora (dieta tipo mediterránea o DASH, con alta calidad nutricional)';
    },

    // Probabilidad estimada de reducción o suspensión de medicamentos
    probabilidadSuspensionMed() {
      const reduccionTotal = this.hba1cActual - this.hba1cReducida;
      if (reduccionTotal >= 1.5) return 'Alta';
      if (reduccionTotal >= 0.8) return 'Media';
      return 'Baja';
    },

    // Riesgo cardiovascular proyectado (modelo simple educativo)
    riesgoCardiovascular() {
      const score =
        (this.edad >= 65 ? 3 : 0) +
        (this.hba1cActual >= 9.0 ? 2 : 0) +
        (this.nivelActividadProyectado() < 50 ? 1 : 0) +
        (this.nivelDietaProyectado() < 50 ? 1 : 0) +
        (((this.pesoActual - this.pesoMeta) / this.pesoActual) < 0.05 ? 1 : 0);

      if (score >= 4) return 'Alto';
      if (score >= 2) return 'Medio';
      return 'Bajo';
    },

    // Reducción estimada en el riesgo de complicaciones microvasculares
    riesgoMicrovasc() {
      const reduccionTotal = this.hba1cActual - this.hba1cReducida;
      // Basado en UKPDS: ~37% reducción por cada 1% reducción HbA1c
      return Math.min(100, (reduccionTotal * 37)).toFixed(0);
    },

    // Tiempo estimado para observar beneficio clínico
    tiempoBeneficio() {
      const perdidaPesoPct = ((this.pesoActual - this.pesoMeta) / this.pesoActual) * 100;
      const dietaMejora = this.mejoraDieta;
      const actividadMejora = this.mejoraActividad;

      const mejorasAltas = (perdidaPesoPct >= 10 ? 1 : 0) + (dietaMejora >= 50 ? 1 : 0) + (actividadMejora >= 50 ? 1 : 0);
      const mejorasModeradas = (perdidaPesoPct >= 5 ? 1 : 0) + (dietaMejora >= 30 ? 1 : 0) + (actividadMejora >= 30 ? 1 : 0);
      const mejorasLeves = (perdidaPesoPct >= 2 ? 1 : 0) + (dietaMejora >= 10 ? 1 : 0) + (actividadMejora >= 10 ? 1 : 0);

      if (this.hba1cActual >= 9 && mejorasAltas >= 2) {
        return '6 meses o más';
      } else if (mejorasAltas >= 2) {
        return '3 meses';
      } else if (mejorasModeradas >= 2) {
        return '3-6 meses';
      } else if (mejorasLeves >= 1) {
        return '6 meses o más';
      }
      return '—';
    },

    // Probabilidad estimada de remisión parcial
    probabilidadRemision() {
      const perdidaPesoPct = ((this.pesoActual - this.pesoMeta) / this.pesoActual) * 100;
      const dietaProy = this.nivelDietaProyectado();
      const actividadProy = this.nivelActividadProyectado();

      if (perdidaPesoPct >= 10 && this.hba1cReducida < 6.5) {
        if (dietaProy >= 50 && actividadProy >= 50) {
          return 'Muy posible';
        } else if (dietaProy >= 30 && actividadProy >= 30) {
          return 'Posible';
        } else {
          return 'Poco probable';
        }
      }
      return 'Improbable';
    }
  },

  methods: {
    // Base de nivel de actividad según selección actual
    actividadBase() {
      switch (this.actividadActual) {
        case 'sedentario': return 0;
        case 'ligera': return 25;
        case 'moderada': return 50;
        case 'alta': return 100;
        default: return 0;
      }
    },

    // Base de calidad de dieta según selección actual
    dietaBase() {
      switch (this.dietaActual) {
        case 'muy deficiente': return 0;
        case 'deficiente': return 25;
        case 'aceptable': return 50;
        case 'buena': return 75;
        case 'muy buena': return 100;
        default: return 0;
      }
    },

    // Nivel proyectado total de actividad física
    nivelActividadProyectado() {
      return Math.min(100, this.actividadBase() + this.mejoraActividad);
    },

    // Nivel proyectado total de calidad de dieta
    nivelDietaProyectado() {
      return Math.min(100, this.dietaBase() + this.mejoraDieta);
    },

    // Renderiza el gráfico de HbA1c (Chart.js)
    renderChart() {
      const canvas = this.$refs.hba1cCanvas;
      if (!canvas) {
        console.warn('⚠️ Canvas no disponible.');
        return;
      }

      const context = canvas.getContext('2d');

      // Si ya existe gráfico previo, destruirlo
      if (this.chart) {
        console.log('♻️ Destruyendo gráfico para recrearlo.');
        this.chart.destroy();
        this.chart = null;
      }

      console.log('✅ Creando gráfico (sin animación).');

      this.chart = new Chart(context, {
        type: 'bar',
        data: {
          labels: ['HbA1c actual', 'HbA1c proyectada'],
          datasets: [{
            label: 'HbA1c (%)',
            data: [this.hba1cActual, this.hba1cReducida],
            backgroundColor: ['#dc3545', '#198754']
          }]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: 14
            }
          }
        }
      });
    },

    // Función utilitaria debounce para evitar renders excesivos
    debounce(fn, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          fn.apply(this, args);
        }, delay);
      };
    }
  },

  mounted() {
    console.log('🏗️ Montando app. Activando chartReady...');
    // Inicializa debounce del gráfico
    this.debouncedUpdateChart = this.debounce(() => {
      this.renderChart();
    }, 200);

    this.chartReady = true;
  },

  watch: {
    // Cuando chartReady cambia, renderizar el gráfico
    chartReady(newVal) {
      if (newVal) {
        console.log('👀 chartReady activado. Montando gráfico...');
        this.$nextTick(() => {
          this.renderChart();
        });
      }
    },

    // Si cambia HbA1c proyectada, actualizar el gráfico
    hba1cReducida() {
      console.log('🕑 hba1cReducida cambió. Programando recreación de gráfico.');
      this.debouncedUpdateChart();
    }
  }
}).mount('#app');
