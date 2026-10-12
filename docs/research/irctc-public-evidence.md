# Public Evidence About IRCTC, NGeT, and Tatkal

## Evidence policy

This document separates official public facts from RailFlux assumptions. Capacity terms are preserved exactly: bookings, tickets, passengers, enquiries, HTTP requests, sessions, and concurrent connections are not interchangeable.

## Verified public facts

- Tatkal opens one day before departure at 10:00 for AC classes and 11:00 for non-AC classes, producing a predictable synchronized event.
- The 2014 NGeT launch described capacity of 7,200 ticket bookings per minute, 120,000 concurrent sessions, and 200,000 enquiries per minute.
- A 2016 Ministry release described 15,000 tickets per minute, 300,000 concurrent connections, and 3,000 enquiries per second after integration-layer server and storage expansion.
- IRCTC reports 30,155 successful bookings in one minute on 12 March 2025 and describes NGeT as capable of more than 30,000 bookings per minute.
- Indian Railways reported 31,814 tickets booked in one minute on 22 May 2025.
- A Press Information Bureau release published 4 June 2025 reported that bot activity can account for up to 50% of login attempts in the first five minutes, that 87% of static content was served through a CDN, and that AI-based bot detection was used (reference 5).
- Officially discussed controls include CAPTCHA, server-side timing rules, suspicious-account deactivation, account booking limits, agent exclusion windows, CDN, secure DNS, WAF, anti-bot services, and Aadhaar authentication.
- Public descriptions distinguish the customer-facing IRCTC/NGeT layer from the underlying Passenger Reservation System.

## What is not publicly established

No authoritative public source used by this project establishes IRCTC’s:

- service or microservice boundaries;
- database engines, schemas, partitions, or replication model;
- cache, message broker, container, or cloud platform;
- seat-locking, hold, payment, idempotency, RAC, or waitlist algorithms;
- autoscaling, load-balancing, virtual-queue, or admission implementation;
- latency distributions, SLOs, queue depth, timeout rates, RPO, or RTO.

Redis, Kafka, Kubernetes, sharding, sagas, and event sourcing may be reasonable hypothetical design choices, but they must not be attributed to IRCTC without primary evidence.

## Consequence for RailFlux

The baseline is named:

> **Synthetic legacy-style railway booking reference architecture**

Public facts calibrate workload shape and motivate anti-abuse experiments. They do not define the baseline internals. RailFlux can demonstrate improvement over its baseline, not over the real IRCTC production system.

## Capacity interpretation

- “31,814 tickets/minute” is an observed output point, not an HTTP request limit.
- One reservation may include multiple passengers.
- A successful booking is downstream of login, enquiry, availability, passenger entry, and payment traffic.
- Bot percentage among requests or login attempts does not directly reveal unique users.
- Historical capacity values must be labeled with their year.
- Design targets for a replacement PRS must not be presented as current achieved capacity.

## Primary references

1. Press Information Bureau, NGeT launch and capacity, 2014: <https://www.pib.gov.in/newsite/printrelease.aspx?relid=108681>
2. Ministry of Railways parliamentary reply, 2014: <https://pib.gov.in/newsite/PrintRelease.aspx?relid=112822>
3. Press Information Bureau, automated booking measures and 2016 capacity: <https://pib.gov.in/newsite/PrintRelease.aspx?relid=134603>
4. IRCTC Internet Ticketing overview and 12 March 2025 peak: <https://irctc.com/internet-ticketing.php>
5. Press Information Bureau, published 4 June 2025, covering the 22 May record and bot/CDN controls: <https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2133796&lang=2&reg=48>
6. IRCTC Tatkal booking guide: <https://contents.irctc.co.in/en/TatkalBooking.html>
7. Press Information Bureau, Aadhaar-authenticated Tatkal announcement: <https://www.pib.gov.in/PressReleasePage.aspx?PRID=2135694&lang=2&reg=48>
8. CRIS Passenger Reservation System/NGeT overview: <https://cris.org.in/loadpage?page=proPRS>

## Secondary methodological references

- Currie and Lu, “Modeling Server Usage for Online Ticket Sales,” Winter Simulation Conference 2011: <https://www.informs-sim.org/wsc11papers/067.pdf>
- Grafana k6, open and closed workload models: <https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/>

Secondary system-design blogs may inspire alternatives but are not evidence of production implementation.
