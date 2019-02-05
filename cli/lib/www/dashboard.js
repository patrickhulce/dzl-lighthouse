;(async utils => {
  const {
    fetchData,
    iterateData,
    render,
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
  } = utils

  const {data, sortedBatchIds, currentBatchId} = await fetchData()

  const dataPointNames = _.uniq(_.flattenDeep(_.map(data, v => _.map(v, v => _.keys(v)))))
  const tiles = []
  const totalBatchCounts = {}
  const moreThan3Variation = {}
  const moreThan10Variation = {}
  const varianceProps = [
    ['audit-score-first-contentful-paint', 'fcp'],
    ['audit-score-interactive', 'tti'],
    ['audit-score-speed-index', 'si'],
    ['audit-score-first-cpu-idle', 'fcpui'],
  ]

  const lines = []
  for (const [prop, abbrev] of varianceProps) {
    const abbrevTitle = abbrev.toUpperCase()
    totalBatchCounts[prop] = {}
    moreThan3Variation[prop] = {}
    moreThan10Variation[prop] = {}

    const allEntries = []
    const allOccurences = []
    iterateData(prop, {
      onURL(values, {url, batchId}) {
        totalBatchCounts[prop][batchId] = totalBatchCounts[prop][batchId] || 0
        moreThan3Variation[prop][batchId] = moreThan3Variation[prop][batchId] || 0
        moreThan10Variation[prop][batchId] = moreThan10Variation[prop][batchId] || 0

        const mean = Math.round(_.mean(values))
        const variation = values.map(x => Math.abs(mean - Math.round(x)))
        const numMoreThan3 = variation.filter(x => x > 3).length
        const numMoreThan10 = variation.filter(x => x > 10).length
        allOccurences.push(...variation)

        totalBatchCounts[prop][batchId] += 1
        if (numMoreThan3 > variation.length * 0.05) {
          moreThan3Variation[prop][batchId] += 1
        }
        if (numMoreThan10 > variation.length * 0.05) {
          moreThan10Variation[prop][batchId] += 1
        }

        allEntries.push({url, numMoreThan3, numMoreThan10})
      },
    })

    const line3 = {name: `${abbrevTitle} >3`, x: [], y: [], type: 'scatter', mode: 'lines'}
    const line10 = {name: `${abbrevTitle} >10`, x: [], y: [], type: 'scatter', mode: 'lines'}
    sortedBatchIds.forEach((batchId, index) => {
      line3.x.push(index)
      line3.y.push((100 * moreThan3Variation[prop][batchId]) / totalBatchCounts[prop][batchId])
      line10.x.push(index)
      line10.y.push((100 * moreThan10Variation[prop][batchId]) / totalBatchCounts[prop][batchId])
    })

    lines.push(line3, line10)
    tiles.push([
      `${abbrev}-variance-3`,
      () => ((100 * allOccurences.filter(n => n > 3).length) / allOccurences.length).toFixed(1),
      {title: `${abbrev.toUpperCase()} >3`, unit: '%', warnThreshold: 7, errorThreshold: 10},
    ])

    tiles.push([
      `${abbrev}-variance-10`,
      () => ((100 * allOccurences.filter(n => n > 10).length) / allOccurences.length).toFixed(1),
      {title: `${abbrev.toUpperCase()} >10`, unit: '%', warnThreshold: 0.7, errorThreshold: 1},
    ])

    const tableRows = []
    const groupedByURL = _(allEntries)
      .groupBy('url')
      .mapValues(entries => ({
        url: entries[0].url,
        numMoreThan3: _.sumBy(entries, 'numMoreThan3'),
        numMoreThan10: _.sumBy(entries, 'numMoreThan10'),
      }))
      .values()
      .filter(entry => entry.numMoreThan3)
      .value()
    for (const entry of _.reverse(_.sortBy(groupedByURL, 'numMoreThan3'))) {
      tableRows.push(
        `<tr><td>${entry.url}</td><td>${entry.numMoreThan3} / ${entry.numMoreThan10}</td></tr>`,
      )
    }

    const div = document.getElementById(`${abbrev}-variance-list`)
    const table = `<table class="table"><tr><th>URL</th><th>Counts (>3 / >10)</th></tr>${tableRows.join(
      '',
    )}</table>`
    div.innerHTML = table
  }

  const ticktext = sortedBatchIds.map(batchId => data[batchId].metadata.hashDate)
  const graphs = [
    [
      'metric-score-variance',
      () => lines,
      {
        title: 'Metric Score Variance Over Time',
        showlegend: true,
        yaxis: {ticksuffix: '%'},
        xaxis: {
          zeroline: false,
          tickmode: 'array',
          ticktext: ticktext,
          tickvals: ticktext.map((_, idx) => idx),
          nticks: ticktext.length,
        },
      },
    ],
  ]

  const diagnosticContainerEl = document.getElementById('diagnostics-row')
  for (const dataPointName of dataPointNames) {
    if (!/^diagnostic.*deltasPercent/.test(dataPointName)) continue

    const containerEl = document.createElement('div')
    containerEl.classList.add(window.innerWidth > 1200 ? 'col-3' : 'col-4')
    const graphContainerEl = document.createElement('div')
    graphContainerEl.classList.add('col-12', 'graph')
    graphContainerEl.id = `${dataPointName}-graph`
    const averageEl = document.createElement('div')
    averageEl.classList.add('col-6', 'tile')
    averageEl.id = `${dataPointName}-avg`
    const tailEl = document.createElement('div')
    tailEl.classList.add('col-6', 'tile')
    tailEl.id = `${dataPointName}-tail`

    containerEl.innerHTML = `
    <div class="row graph-row"></div>
    <div class="row tile-row"></div>
    `
    containerEl.querySelector('.graph-row').appendChild(graphContainerEl)
    containerEl.querySelector('.graph-row').appendChild(averageEl)
    containerEl.querySelector('.graph-row').appendChild(tailEl)

    const friendlyName = _.startCase(dataPointName)
      .replace(/Diagnostic /, '')
      .replace(/Deltas Percent/, '')

    graphs.push([
      graphContainerEl.id,
      () => {
        const histData = getHistogramData(dataPointName)
        histData[0].x = histData[0].x.map(x => Math.min(x, 99))
        Object.assign(histData[0], {xbins: {start: 0, end: 100, size: 10}})
        return histData
      },
      {
        margin: {
          l: 30,
          r: 30,
          b: 30,
          t: 30,
          pad: 0,
        },
        font: {
          family: 'Courier New, monospace',
          size: 10,
        },
        title: friendlyName,
        xaxis: {ticksuffix: '%', range: [0, 100]},
      },
    ])

    tiles.push(
      [
        averageEl.id,
        () => getAverageValue(dataPointName),
        {title: 'Avg', unit: '%', warnThreshold: 10, errorThreshold: 30},
      ],
      [
        tailEl.id,
        () => get99thValue(dataPointName),
        {title: '99th', unit: '%', warnThreshold: 50, errorThreshold: 80},
      ],
    )

    diagnosticContainerEl.appendChild(containerEl)
  }

  graphs.push(
    ...[
      [
        'runtime-box-whisker',
        () => getBoxAndWhiskerData('timing-total'),
        {
          title: 'Runtime Over Time',
          yaxis: {ticksuffix: ' s'},
          xaxis: {
            zeroline: false,
            showticklabels: false,
          },
        },
      ],
      [
        'tti-variance-box-whisker',
        () => getBoxAndWhiskerData('interactive-deltasPercent'),
        {
          title: 'TTI Deltas Over Time',
          yaxis: {ticksuffix: '%', range: [0, 25]},
          xaxis: {
            zeroline: false,
            showticklabels: false,
          },
        },
      ],
      [
        'runtime-histogram',
        () => getHistogramData('timing-total'),
        {
          title: 'Runtime Distribution',
          xaxis: {ticksuffix: ' s'},
        },
      ],
      [
        'tti-variance-histogram',
        () => getHistogramData('interactive-deltasPercent'),
        {
          title: 'TTI Deltas Distribution',
          xaxis: {ticksuffix: '%'},
        },
      ],
    ],
  )

  tiles.push(
    ...[
      [
        'runtime-avg',
        () => getAverageValue('timing-total'),
        {title: 'Avg Runtime', unit: 's', warnThreshold: 15, errorThreshold: 30},
      ],
      [
        'runtime-99th',
        () => get99thValue('timing-total'),
        {title: '99th Runtime', unit: 's', warnThreshold: 30, errorThreshold: 45},
      ],
      [
        'tti-avg',
        () => getAverageValue('interactive-deltasPercent'),
        {title: 'Avg TTI Delta', unit: '%', warnThreshold: 5, errorThreshold: 10},
      ],
      [
        'tti-99th',
        () => get99thValue('interactive-deltasPercent'),
        {title: '99th TTI Delta', unit: '%', warnThreshold: 10, errorThreshold: 20},
      ],
    ],
  )

  render({graphs, tiles})
})(window.utils)
