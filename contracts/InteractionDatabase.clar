(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DRUG-ID u101)
(define-constant ERR-INVALID-SEVERITY u102)
(define-constant ERR-INVALID-DESCRIPTION u103)
(define-constant ERR-INVALID-EFFECTS u104)
(define-constant ERR-INVALID-RECOMMENDATIONS u105)
(define-constant ERR-INTERACTION-ALREADY-EXISTS u106)
(define-constant ERR-INTERACTION-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-SOURCE-HASH u110)
(define-constant ERR-INVALID-VERSION u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-INTERACTIONS-EXCEEDED u114)
(define-constant ERR-INVALID-INTERACTION-TYPE u115)
(define-constant ERR-INVALID-CONTRAINDICATION u116)
(define-constant ERR-INVALID-ONSET u117)
(define-constant ERR-INVALID-DURATION u118)
(define-constant ERR-INVALID-EVIDENCE-LEVEL u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var next-interaction-id uint u0)
(define-data-var max-interactions uint u100000)
(define-data-var update-fee uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map interactions
  { drug1: uint, drug2: uint }
  {
    severity: uint,
    description: (string-utf8 500),
    effects: (string-utf8 1000),
    recommendations: (string-utf8 500),
    source-hash: (buff 32),
    timestamp: uint,
    creator: principal,
    interaction-type: (string-utf8 50),
    contraindication: bool,
    onset: uint,
    duration: uint,
    evidence-level: uint,
    status: bool,
    version: uint
  }
)

(define-map interactions-by-hash
  (buff 32)
  { drug1: uint, drug2: uint }
)

(define-map interaction-updates
  { drug1: uint, drug2: uint }
  {
    update-severity: uint,
    update-description: (string-utf8 500),
    update-timestamp: uint,
    updater: principal,
    update-version: uint
  }
)

(define-read-only (get-interaction (drug1 uint) (drug2 uint))
  (map-get? interactions { drug1: (min drug1 drug2), drug2: (max drug1 drug2) })
)

(define-read-only (get-interaction-updates (drug1 uint) (drug2 uint))
  (map-get? interaction-updates { drug1: (min drug1 drug2), drug2: (max drug1 drug2) })
)

(define-read-only (is-interaction-registered (source-hash (buff 32)))
  (is-some (map-get? interactions-by-hash source-hash))
)

(define-private (validate-drug-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-DRUG-ID))
)

(define-private (validate-severity (sev uint))
  (if (and (>= sev u0) (<= sev u2))
      (ok true)
      (err ERR-INVALID-SEVERITY))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-effects (eff (string-utf8 1000)))
  (if (and (> (len eff) u0) (<= (len eff) u1000))
      (ok true)
      (err ERR-INVALID-EFFECTS))
)

(define-private (validate-recommendations (rec (string-utf8 500)))
  (if (<= (len rec) u500)
      (ok true)
      (err ERR-INVALID-RECOMMENDATIONS))
)

(define-private (validate-source-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-SOURCE-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-interaction-type (typ (string-utf8 50)))
  (if (or (is-eq typ "pharmacokinetic") (is-eq typ "pharmacodynamic") (is-eq typ "unknown"))
      (ok true)
      (err ERR-INVALID-INTERACTION-TYPE))
)

(define-private (validate-contraindication (contra bool))
  (ok true)
)

(define-private (validate-onset (ons uint))
  (if (>= ons u0)
      (ok true)
      (err ERR-INVALID-ONSET))
)

(define-private (validate-duration (dur uint))
  (if (>= dur u0)
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-evidence-level (lev uint))
  (if (and (>= lev u0) (<= lev u5))
      (ok true)
      (err ERR-INVALID-EVIDENCE-LEVEL))
)

(define-private (validate-version (ver uint))
  (if (> ver u0)
      (ok true)
      (err ERR-INVALID-VERSION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-interactions (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-interactions new-max)
    (ok true)
  )
)

(define-public (set-update-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set update-fee new-fee)
    (ok true)
  )
)

(define-public (add-interaction
  (drug1 uint)
  (drug2 uint)
  (severity uint)
  (description (string-utf8 500))
  (effects (string-utf8 1000))
  (recommendations (string-utf8 500))
  (source-hash (buff 32))
  (interaction-type (string-utf8 50))
  (contraindication bool)
  (onset uint)
  (duration uint)
  (evidence-level uint)
  (version uint)
)
  (let (
        (next-id (var-get next-interaction-id))
        (current-max (var-get max-interactions))
        (authority (var-get authority-contract))
        (key { drug1: (min drug1 drug2), drug2: (max drug1 drug2) })
      )
    (asserts! (< next-id current-max) (err ERR-MAX-INTERACTIONS-EXCEEDED))
    (try! (validate-drug-id drug1))
    (try! (validate-drug-id drug2))
    (try! (validate-severity severity))
    (try! (validate-description description))
    (try! (validate-effects effects))
    (try! (validate-recommendations recommendations))
    (try! (validate-source-hash source-hash))
    (try! (validate-interaction-type interaction-type))
    (try! (validate-contraindication contraindication))
    (try! (validate-onset onset))
    (try! (validate-duration duration))
    (try! (validate-evidence-level evidence-level))
    (try! (validate-version version))
    (asserts! (is-none (map-get? interactions key)) (err ERR-INTERACTION-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get update-fee) tx-sender authority-recipient))
    )
    (map-set interactions key
      {
        severity: severity,
        description: description,
        effects: effects,
        recommendations: recommendations,
        source-hash: source-hash,
        timestamp: block-height,
        creator: tx-sender,
        interaction-type: interaction-type,
        contraindication: contraindication,
        onset: onset,
        duration: duration,
        evidence-level: evidence-level,
        status: true,
        version: version
      }
    )
    (map-set interactions-by-hash source-hash key)
    (var-set next-interaction-id (+ next-id u1))
    (print { event: "interaction-added", drug1: drug1, drug2: drug2 })
    (ok true)
  )
)

(define-public (update-interaction
  (drug1 uint)
  (drug2 uint)
  (update-severity uint)
  (update-description (string-utf8 500))
  (update-version uint)
)
  (let ((key { drug1: (min drug1 drug2), drug2: (max drug1 drug2) })
        (interaction (map-get? interactions key)))
    (match interaction
      i
        (begin
          (asserts! (is-eq (get creator i) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-severity update-severity))
          (try! (validate-description update-description))
          (try! (validate-version update-version))
          (asserts! (> update-version (get version i)) (err ERR-INVALID-VERSION))
          (map-set interactions key
            {
              severity: update-severity,
              description: update-description,
              effects: (get effects i),
              recommendations: (get recommendations i),
              source-hash: (get source-hash i),
              timestamp: block-height,
              creator: (get creator i),
              interaction-type: (get interaction-type i),
              contraindication: (get contraindication i),
              onset: (get onset i),
              duration: (get duration i),
              evidence-level: (get evidence-level i),
              status: (get status i),
              version: update-version
            }
          )
          (map-set interaction-updates key
            {
              update-severity: update-severity,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender,
              update-version: update-version
            }
          )
          (print { event: "interaction-updated", drug1: drug1, drug2: drug2 })
          (ok true)
        )
      (err ERR-INTERACTION-NOT-FOUND)
    )
  )
)

(define-public (get-interaction-count)
  (ok (var-get next-interaction-id))
)

(define-public (check-interaction-existence (drug1 uint) (drug2 uint))
  (ok (is-some (get-interaction drug1 drug2)))
)