const { createApp } = Vue;

createApp({
  data() {
    return {
      edad: 50,
      sexo: 'masculino',
      pesoActual: 80,
      pesoMeta: 75,
      actividadActual: 'sedentario',
      mejoraActividad: 0,
      dietaActual: 'deficiente',
      mejoraDieta: 0,
      hba1cActual: 8.0,
      chart: null,
      chartReady: false,
      debouncedUpdateChart: null,
      mostrarInterpretacion: false
    };
  },
  computed: {
    hba1cReducida() {
      let reduccion = 0;

      // Pérdida de peso (modelo no lineal, ponderada por HbA1c inicial)
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

      // Mejora actividad física (máx 0.6%), saturación
      const actividadPct = this.nivelActividadProyectado();
      const actividadFactor = Math.sqrt(actividadPct / 100);
      reduccion += 0.6 * actividadFactor;

      // Mejora dieta (máx 0.5%), saturación
      const dietaPct = this.nivelDietaProyectado();
      const dietaFactor = Math.sqrt(dietaPct / 100);
      reduccion += 0.5 * dietaFactor;

      return Math.max(3.5, this.hba1cActual - reduccion).toFixed(2);
    },
    probabilidadSuspensionMed() {
      const reduccionTotal = this.hba1cActual - this.hba1cReducida;
      if (reduccionTotal >= 1.5) return 'Alta';
      if (reduccionTotal >= 0.8) return 'Media';
      return 'Baja';
    },
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
    riesgoMicrovasc() {
      const reduccionTotal = this.hba1cActual - this.hba1cReducida;
      return Math.min(100, (reduccionTotal * 37)).toFixed(0);
    },
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
    actividadBase() {
      switch (this.actividadActual) {
        case 'sedentario': return 0;
        case 'ligera': return 25;
        case 'moderada': return 50;
        case 'alta': return 100;
        default: return 0;
      }
    },
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
    nivelActividadProyectado() {
      return Math.min(100, this.actividadBase() + this.mejoraActividad);
    },
    nivelDietaProyectado() {
      return Math.min(100, this.dietaBase() + this.mejoraDieta);
    },
    renderChart() {
      const canvas = this.$refs.hba1cCanvas;
      if (!canvas) {
        console.warn('⚠️ Canvas no disponible.');
        return;
      }

      const context = canvas.getContext('2d');

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
    this.debouncedUpdateChart = this.debounce(() => {
      this.renderChart();
    }, 200);

    this.chartReady = true;
  },
  watch: {
    chartReady(newVal) {
      if (newVal) {
        console.log('👀 chartReady activado. Montando gráfico...');
        this.$nextTick(() => {
          this.renderChart();
        });
      }
    },
    hba1cReducida() {
      console.log('🕑 hba1cReducida cambió. Programando recreación de gráfico.');
      this.debouncedUpdateChart();
    }
  }
}).mount('#app');
