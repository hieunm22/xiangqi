setup-env:
	yarn
	git checkout HEAD -- yarn.lock

reset:
	rm -rf dist
	rm -rf node_modules
	rm -rf coverage
	rm -rf src/generated
	rm -f .env.local
	git reset --hard

reset-db:
	npx prisma migrate reset --force
	npx prisma db push

destroy:
	@if docker container inspect xiangqi-api >/dev/null 2>&1; then \
		docker container stop xiangqi-api; \
		docker container rm xiangqi-api; \
		docker image rm xiangqi-api; \
	else \
		echo "Container xiangqi-api does not exist"; \
	fi

docker:
	rm -rf dist
	npx prisma generate
	yarn build
	docker build -t xiangqi-api -f Dockerfile .
	docker run --name xiangqi-api -ditp 5001:8000 --restart unless-stopped --env-file ./.env.local --network xiangqi-network xiangqi-api

publish:
	make destroy
	make docker

start:
	make setup-env
	yarn dev

package:
	yarn
	git checkout HEAD -- yarn.lock
	yarn dev
