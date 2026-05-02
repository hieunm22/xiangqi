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

destroy:
	docker container stop xiangqi-api
	docker container rm xiangqi-api
	docker image rm xiangqi-api

docker:
	rm -rf dist
	npx prisma generate
	yarn build
	cp -r src/generated dist/
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
