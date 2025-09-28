(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DRUG-NAME u101)
(define-constant ERR-INVALID-CATEGORY u102)
(define-constant ERR-INVALID-SPEC-HASH u103)
(define-constant ERR-DRUG-ALREADY-EXISTS u104)
(define-constant ERR-DRUG-NOT-FOUND u105)
(define-constant ERR-INVALID-TIMESTAMP u106)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u107)
(define-constant ERR-INVALID-MAX_DRUGS u108)
(define-constant ERR-INVALID-UPDATE-PARAM u109)
(define-constant ERR-MAX-DRUGS-EXCEEDED u110)
(define-constant ERR-INVALID-STATUS u111)
(define-constant ERR-INVALID-DOSAGE-FORM u112)
(define-constant ERR-INVALID-MANUFACTURER u113)
(define-constant ERR-INVALID-APPROVAL-DATE u114)
(define-constant ERR-INVALID-EXPIRY-DATE u115)
(define-constant ERR-INVALID-ATC-CODE u116)
(define-constant ERR-INVALID-INDICATION u117)
(define-constant ERR-INVALID-CONTRAINDICATION u118)
(define-constant ERR-INVALID-SIDE-EFFECTS u119)
(define-constant ERR-INVALID-VERSION u120)

(define-data-var next-drug-id uint u0)
(define-data-var max-drugs uint u100000)
(define-data-var registration-fee uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map drugs
  uint
  {
    name: (string-utf8 100),
    category: (string-utf8 50),
    spec-hash: (buff 32),
    timestamp: uint,
    creator: principal,
    status: bool,
    dosage-form: (string-utf8 50),
    manufacturer: (string-utf8 100),
    approval-date: uint,
    expiry-date: uint,
    atc-code: (string-utf8 20),
    indication: (string-utf8 500),
    contraindication: (string-utf8 500),
    side-effects: (string-utf8 1000),
    version: uint
  }
)

(define-map drugs-by-name
  (string-utf8 100)
  uint)

(define-map drug-updates
  uint
  {
    update-name: (string-utf8 100),
    update-category: (string-utf8 50),
    update-timestamp: uint,
    updater: principal,
    update-version: uint
  }
)

(define-read-only (get-drug (id uint))
  (map-get? drugs id)
)

(define-read-only (get-drug-updates (id uint))
  (map-get? drug-updates id)
)

(define-read-only (is-drug-registered (name (string-utf8 100)))
  (is-some (map-get? drugs-by-name name))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-DRUG-NAME))
)

(define-private (validate-category (category (string-utf8 50)))
  (if (and (> (len category) u0) (<= (len category) u50))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-spec-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-SPEC-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-dosage-form (form (string-utf8 50)))
  (if (<= (len form) u50)
      (ok true)
      (err ERR-INVALID-DOSAGE-FORM))
)

(define-private (validate-manufacturer (manu (string-utf8 100)))
  (if (<= (len manu) u100)
      (ok true)
      (err ERR-INVALID-MANUFACTURER))
)

(define-private (validate-approval-date (date uint))
  (if (> date u0)
      (ok true)
      (err ERR-INVALID-APPROVAL-DATE))
)

(define-private (validate-expiry-date (date uint))
  (if (> date u0)
      (ok true)
      (err ERR-INVALID-EXPIRY-DATE))
)

(define-private (validate-atc-code (code (string-utf8 20)))
  (if (<= (len code) u20)
      (ok true)
      (err ERR-INVALID-ATC-CODE))
)

(define-private (validate-indication (ind (string-utf8 500)))
  (if (<= (len ind) u500)
      (ok true)
      (err ERR-INVALID-INDICATION))
)

(define-private (validate-contraindication (contra (string-utf8 500)))
  (if (<= (len contra) u500)
      (ok true)
      (err ERR-INVALID-CONTRAINDICATION))
)

(define-private (validate-side-effects (side (string-utf8 1000)))
  (if (<= (len side) u1000)
      (ok true)
      (err ERR-INVALID-SIDE-EFFECTS))
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

(define-public (set-max-drugs (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX_DRUGS))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-drugs new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (add-drug
  (name (string-utf8 100))
  (category (string-utf8 50))
  (spec-hash (buff 32))
  (dosage-form (string-utf8 50))
  (manufacturer (string-utf8 100))
  (approval-date uint)
  (expiry-date uint)
  (atc-code (string-utf8 20))
  (indication (string-utf8 500))
  (contraindication (string-utf8 500))
  (side-effects (string-utf8 1000))
  (version uint)
)
  (let (
        (next-id (var-get next-drug-id))
        (current-max (var-get max-drugs))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-DRUGS-EXCEEDED))
    (try! (validate-name name))
    (try! (validate-category category))
    (try! (validate-spec-hash spec-hash))
    (try! (validate-dosage-form dosage-form))
    (try! (validate-manufacturer manufacturer))
    (try! (validate-approval-date approval-date))
    (try! (validate-expiry-date expiry-date))
    (try! (validate-atc-code atc-code))
    (try! (validate-indication indication))
    (try! (validate-contraindication contraindication))
    (try! (validate-side-effects side-effects))
    (try! (validate-version version))
    (asserts! (is-none (map-get? drugs-by-name name)) (err ERR-DRUG-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set drugs next-id
      {
        name: name,
        category: category,
        spec-hash: spec-hash,
        timestamp: block-height,
        creator: tx-sender,
        status: true,
        dosage-form: dosage-form,
        manufacturer: manufacturer,
        approval-date: approval-date,
        expiry-date: expiry-date,
        atc-code: atc-code,
        indication: indication,
        contraindication: contraindication,
        side-effects: side-effects,
        version: version
      }
    )
    (map-set drugs-by-name name next-id)
    (var-set next-drug-id (+ next-id u1))
    (print { event: "drug-added", id: next-id })
    (ok next-id)
  )
)

(define-public (update-drug
  (drug-id uint)
  (update-name (string-utf8 100))
  (update-category (string-utf8 50))
  (update-version uint)
)
  (let ((drug (map-get? drugs drug-id)))
    (match drug
      d
        (begin
          (asserts! (is-eq (get creator d) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-name update-name))
          (try! (validate-category update-category))
          (try! (validate-version update-version))
          (asserts! (> update-version (get version d)) (err ERR-INVALID-VERSION))
          (let ((existing (map-get? drugs-by-name update-name)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id drug-id) (err ERR-DRUG-ALREADY-EXISTS))
              (begin true)
            )
          )
          (let ((old-name (get name d)))
            (if (is-eq old-name update-name)
                (ok true)
                (begin
                  (map-delete drugs-by-name old-name)
                  (map-set drugs-by-name update-name drug-id)
                  (ok true)
                )
            )
          )
          (map-set drugs drug-id
            {
              name: update-name,
              category: update-category,
              spec-hash: (get spec-hash d),
              timestamp: block-height,
              creator: (get creator d),
              status: (get status d),
              dosage-form: (get dosage-form d),
              manufacturer: (get manufacturer d),
              approval-date: (get approval-date d),
              expiry-date: (get expiry-date d),
              atc-code: (get atc-code d),
              indication: (get indication d),
              contraindication: (get contraindication d),
              side-effects: (get side-effects d),
              version: update-version
            }
          )
          (map-set drug-updates drug-id
            {
              update-name: update-name,
              update-category: update-category,
              update-timestamp: block-height,
              updater: tx-sender,
              update-version: update-version
            }
          )
          (print { event: "drug-updated", id: drug-id })
          (ok true)
        )
      (err ERR-DRUG-NOT-FOUND)
    )
  )
)

(define-public (get-drug-count)
  (ok (var-get next-drug-id))
)

(define-public (check-drug-existence (name (string-utf8 100)))
  (ok (is-drug-registered name))
)